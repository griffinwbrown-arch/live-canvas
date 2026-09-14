using System;
using System.Globalization;
using System.Runtime.InteropServices;
namespace LiveCanvas {
  public static class InputBridge {
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; public Point(int x, int y) { X=x; Y=y; } }
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] static extern IntPtr ChildWindowFromPointEx(IntPtr parent, Point point, uint flags);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr hwnd, ref Point point);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out Rect rect, int size);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint message, IntPtr wp, IntPtr lp, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr process);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] static extern uint GetDoubleClickTime();
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint mapType);
    static IntPtr held=IntPtr.Zero, hovered=IntPtr.Zero, lastTarget=IntPtr.Zero, movingRoot=IntPtr.Zero;
    static Point lastPoint, moveStart;
    static Rect moveRect, captureRect;
    static int heldButtons, movingHit, lastClickButton;
    static long lastClickAt;
    static Point lastClickPoint;
    static IntPtr lastClickTarget;
    static IntPtr Pack(int x, int y) { return new IntPtr(unchecked((int)(((uint)y & 65535)<<16 | ((uint)x & 65535)))); }
    static int Mask(int domButtons, int mods) { return ((domButtons&1)!=0?1:0) | ((domButtons&2)!=0?2:0) | ((domButtons&4)!=0?16:0) | ((mods&1)!=0?4:0) | ((mods&2)!=0?8:0); }
    static uint Down(int button) { return button==2?0x204u:button==1?0x207u:0x201u; }
    static uint Up(int button) { return Down(button)+1; }
    static void Send(IntPtr hwnd, uint msg, int wp, Point p, bool screenCoords=false) {
      if (hwnd==IntPtr.Zero || !IsWindow(hwnd)) return;
      if (!screenCoords) ScreenToClient(hwnd, ref p);
      if (!PostMessage(hwnd,msg,new IntPtr(wp),Pack(p.X,p.Y))) throw new Exception("Windows rejected input to this window. It may be running as administrator.");
    }
    static void Wheel(IntPtr hwnd, int delta, int mask, Point screenPoint, bool horizontal) {
      // Establish the hover target before sending a wheel message. Synchronous delivery
      // avoids scrolling the previous target when movement and wheel arrive together.
      Point client=screenPoint; ScreenToClient(hwnd,ref client); IntPtr result;
      if(SendMessageTimeout(hwnd,0x200,new IntPtr(mask),Pack(client.X,client.Y),2,250,out result)==IntPtr.Zero) throw new Exception("The source window is not responding to pointer input.");
      int wp=unchecked((delta<<16)|mask);
      if(SendMessageTimeout(hwnd,horizontal?0x20Eu:0x20Au,new IntPtr(wp),Pack(screenPoint.X,screenPoint.Y),2,250,out result)==IntPtr.Zero) throw new Exception("The source window is not responding to scrolling.");
    }
    static IntPtr ChildAt(IntPtr root, Point p) {
      IntPtr current=root;
      for (int i=0;i<12;i++) { Point client=p; ScreenToClient(current, ref client); IntPtr child=ChildWindowFromPointEx(current,client,7); if(child==IntPtr.Zero || child==current) break; current=child; }
      return current;
    }
    static void Focus(IntPtr root) {
      uint current=GetCurrentThreadId(), foreground=GetWindowThreadProcessId(GetForegroundWindow(),IntPtr.Zero);
      bool attached=current!=foreground && AttachThreadInput(current,foreground,true);
      try { SetForegroundWindow(root); } finally { if(attached) AttachThreadInput(current,foreground,false); }
    }
    static void Release() {
      if(held!=IntPtr.Zero) { if((heldButtons&1)!=0) Send(held,Up(0),0,lastPoint); if((heldButtons&2)!=0) Send(held,Up(2),0,lastPoint); if((heldButtons&4)!=0) Send(held,Up(1),0,lastPoint); }
      held=IntPtr.Zero; heldButtons=0; movingRoot=IntPtr.Zero; movingHit=0;
      if(hovered!=IntPtr.Zero) PostMessage(hovered,0x2A3,IntPtr.Zero,IntPtr.Zero);
      hovered=IntPtr.Zero;
    }
    static void Process(string[] a) {
      string action=a[1];
      if(action=="release") { Release(); return; }
      long handle=long.Parse(a[2]), excluded=long.Parse(a[3]);
      double x=double.Parse(a[4],CultureInfo.InvariantCulture), y=double.Parse(a[5],CultureInfo.InvariantCulture);
      int button=int.Parse(a[6]), buttons=int.Parse(a[7]), dx=int.Parse(a[8]), dy=int.Parse(a[9]), mods=int.Parse(a[10]), key=int.Parse(a[11]);
      IntPtr root=new IntPtr(handle);
      Point point;
      if(handle!=0) {
        if(!IsWindow(root) || IsIconic(root)) { Release(); throw new Exception("The source window is closed or minimized."); }
        Rect rect;
        if(movingRoot!=IntPtr.Zero) rect=captureRect;
        else if(DwmGetWindowAttribute(root,9,out rect,Marshal.SizeOf(typeof(Rect)))!=0) GetWindowRect(root,out rect);
        captureRect=rect;
        point=new Point(rect.Left+(int)Math.Round(x*(rect.Right-rect.Left-1)), rect.Top+(int)Math.Round(y*(rect.Bottom-rect.Top-1)));
      } else point=new Point((int)Math.Round(x),(int)Math.Round(y));
      IntPtr target=handle!=0?ChildAt(root,point):WindowFromPoint(point);
      if(target==IntPtr.Zero) return;
      root=GetAncestor(target,2);
      if(root.ToInt64()==excluded) { Release(); throw new Exception("Choose a source outside Live Canvas to control it."); }
      if(held!=IntPtr.Zero) target=held;
      if(action=="keyDown" || action=="keyUp") {
        target=lastTarget;
        if(target==IntPtr.Zero) return;
        int flags=1|((int)MapVirtualKey((uint)key,0)<<16);
        if(action=="keyUp") flags|=unchecked((int)0xC0000000);
        PostMessage(target,action=="keyDown"?0x100u:0x101u,new IntPtr(key),new IntPtr(flags));
        if(action=="keyDown" && a.Length>12 && a[12].Length>0 && (mods&6)==0) foreach(char c in System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(a[12]))) PostMessage(target,0x102,new IntPtr(c),new IntPtr(1));
        return;
      }
      lastPoint=point;
      if(movingRoot!=IntPtr.Zero) {
        if(action=="move") {
          int mx=point.X-moveStart.X,my=point.Y-moveStart.Y;
          int left=moveRect.Left,top=moveRect.Top,right=moveRect.Right,bottom=moveRect.Bottom;
          if(movingHit==2) { left+=mx;right+=mx;top+=my;bottom+=my; }
          else { if(movingHit==10||movingHit==13||movingHit==16)left+=mx;if(movingHit==11||movingHit==14||movingHit==17)right+=mx;if(movingHit==12||movingHit==13||movingHit==14)top+=my;if(movingHit==15||movingHit==16||movingHit==17)bottom+=my; }
          SetWindowPos(movingRoot,IntPtr.Zero,left,top,Math.Max(150,right-left),Math.Max(100,bottom-top),0x14);
        }
        if(action=="up") Release();
        return;
      }
      if(action=="leave") { if(heldButtons==0 && hovered!=IntPtr.Zero) { PostMessage(hovered,0x2A3,IntPtr.Zero,IntPtr.Zero); hovered=IntPtr.Zero; } return; }
      if(action=="down") {
        IntPtr hit; SendMessageTimeout(root,0x84,IntPtr.Zero,Pack(point.X,point.Y),2,100,out hit);
        int nonclient=hit.ToInt32();
        if(button==0 && (nonclient==2 || (nonclient>=10 && nonclient<=17))) { movingRoot=root; movingHit=nonclient; moveStart=point; GetWindowRect(root,out moveRect); return; }
        if(button==0 && (nonclient==8||nonclient==9||nonclient==20)) { PostMessage(root,0x112,new IntPtr(nonclient==20?0xF060:nonclient==8?0xF020:0xF030),IntPtr.Zero); return; }
        held=target; heldButtons=buttons; lastTarget=target;
        long now=DateTime.UtcNow.Ticks/TimeSpan.TicksPerMillisecond;
        bool twice=lastClickTarget==target && lastClickButton==button && now-lastClickAt<GetDoubleClickTime() && Math.Abs(point.X-lastClickPoint.X)<5 && Math.Abs(point.Y-lastClickPoint.Y)<5;
        Send(target,twice?Down(button)+2:Down(button),Mask(buttons,mods),point);
        lastClickTarget=target;lastClickButton=button;lastClickAt=twice?0:now;lastClickPoint=point;
      } else if(action=="up") {
        Send(target,Up(button),Mask(buttons,mods),point); heldButtons=buttons; if(buttons==0) { held=IntPtr.Zero; Focus(GetAncestor(target,2)); }
      } else if(action=="move") {
        if(hovered!=target && hovered!=IntPtr.Zero && heldButtons==0)PostMessage(hovered,0x2A3,IntPtr.Zero,IntPtr.Zero);
        hovered=target;Send(target,0x200,Mask(buttons,mods),point);
      } else if(action=="wheel") {
        Focus(root);
        if(dy!=0)Wheel(target,-dy,Mask(buttons,mods),point,false);
        if(dx!=0)Wheel(target,dx,Mask(buttons,mods),point,true);
      }
    }
    public static void Run() {
      SetThreadDpiAwarenessContext(new IntPtr(-4));
      Console.WriteLine("READY"); Console.Out.Flush();
      string line;
      try { while((line=Console.ReadLine())!=null) { string[] a=line.Split('\t'); if(a.Length<2)continue; try { Process(a); Console.WriteLine(a[0]+"\tOK"); } catch(Exception e) { Console.WriteLine(a[0]+"\tERR\t"+e.Message.Replace('\t',' ').Replace('\n',' ')); } Console.Out.Flush(); } }
      finally { Release(); }
    }
  }
}
