"""Render illustrative two-screen GIFs. Requires Python 3 and Pillow."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'demos'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1200, 660
BG, INK, MUTED, BLUE, GREEN = '#f4f5f7', '#202b39', '#637185', '#3765ec', '#258267'
LEFT, RIGHT = (38, 183, 552, 505), (648, 183, 1162, 505)
CROP = (152, 88, 616, 374)

def font(size, bold=False):
    candidates = [Path('C:/Windows/Fonts') / ('seguisb.ttf' if bold else 'segoeui.ttf'), Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    return ImageFont.truetype(str(next(p for p in candidates if p.exists())), size)

def text(d, xy, value, size=20, color=INK, bold=False, anchor=None):
    d.text(xy, value, font=font(size,bold), fill=color, anchor=anchor)

def rr(d, box, fill, radius=12, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)

def source(t):
    im=Image.new('RGB',(640,400),'#ffffff');d=ImageDraw.Draw(im)
    d.rectangle((0,0,640,52),fill='#edf0f5')
    text(d,(20,16),'RELEASE REVIEW',18,bold=True)
    text(d,(473,17),'Overview  /  Activity',12,color=MUTED)
    d.rectangle((0,52,125,400),fill='#f5f7fa')
    for i,label in enumerate(['Overview','Audience','Signups','Reports']):
        if i==2:rr(d,(10,151,115,183),'#e5ebff',6)
        text(d,(20,74+i*42),label,13,BLUE if i==2 else MUTED,bold=i==2)
    text(d,(169,104),'Weekly signups',23,bold=True)
    text(d,(169,142),'New accounts across the last 7 days',13,color=MUTED)
    count=284+int(46*math.sin(t*.9))
    text(d,(588,105),str(count),26,BLUE,True,anchor='ra')
    text(d,(588,140),'LIVE',11,GREEN,True,anchor='ra')
    for y in [207,251,295,339]:d.line((171,y,592,y),fill='#e6ebf1',width=1)
    for i in range(7):
        height=55+13*i+int(22*math.sin(t*.9+i*.75))
        x=184+i*58
        rr(d,(x,338-height,x+32,338),BLUE if i==5 else '#a8baf3',4)
        text(d,(x+16,349),['M','T','W','T','F','S','S'][i],11,MUTED,anchor='ma')
    return im

def ink_layer(im, progress):
    d=ImageDraw.Draw(im)
    # Draw around a bar in source coordinates, so zoom carries the ink with it.
    points=[]
    for i in range(91):
        a=2*math.pi*i/90;points.append((336+34*math.cos(a),166+87*math.sin(a)))
    n=max(0,min(len(points),int(progress*len(points))))
    if n>1:d.line(points[:n],fill='#ed6352',width=4)
    if progress>.75:
        k=ease((progress-.75)/.25)
        d.line([(289,59),(int(289+38*k),int(59+26*k))],fill='#ed6352',width=3)
        text(d,(193,33),'Watch this trend',18,'#bd4437',True)
    return im

def fit_view(im, scale=1):
    width,height=RIGHT[2]-RIGHT[0],RIGHT[3]-RIGHT[1]
    base=im.resize((width,height),Image.Resampling.LANCZOS)
    if scale!=1:
        big=base.resize((round(width*scale),round(height*scale)),Image.Resampling.LANCZOS)
        cx=round(width*.69*scale);cy=round(height*.52*scale)
        x=max(0,min(big.width-width,cx-width//2));y=max(0,min(big.height-height,cy-height//2))
        base=big.crop((x,y,x+width,y+height))
    return base

def pointer(d,x,y,pen=False):
    if pen:
        d.line((x+2,y-2,x+22,y-24),fill=INK,width=8)
        d.polygon([(x,y),(x+2,y-12),(x+10,y-4)],fill=INK)
    else:
        pts=[(x,y),(x,y+25),(x+7,y+18),(x+13,y+30),(x+18,y+27),(x+12,y+16),(x+23,y+16)]
        d.polygon(pts,fill='#ffffff',outline=INK,width=2)

def render(t,mode='flow'):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    if mode=='flow':
        phase=0 if t<3.4 else 1 if t<7 else 2 if t<10.5 else 3
        title=['Drag over any monitor area','See that area live on your other screen','Draw directly over the live view','Zoom in with your annotations'][phase]
        active=t>=3.4; drawing=max(0,min(1,(t-7)/2.4));scale=1+.38*ease((t-10.5)/1.4);frozen=False
    elif mode=='zoom':
        title='Zoom in, then return to your selected area';active=True;drawing=1;frozen=False
        scale=1+.65*(ease((t-.5)/1.4) if t<3.2 else 1-ease((t-3.2)/1.4))
        phase=3
    else:
        active=True;drawing=1;scale=1;frozen=1.4<=t<4.7;phase=2
        title='Freeze a frame while the source keeps moving' if frozen else ('Resume the live view' if t>=4.7 else 'Watch the selected area update live');
    text(d,(40,25),'LIVE CANVAS',14,BLUE,True)
    text(d,(40,58),title,31,bold=True)
    text(d,(40,139),'SOURCE MONITOR',15,MUTED,True)
    text(d,(648,139),'DRAWING TABLET / SECOND SCREEN',15,MUTED,True)
    for r in [LEFT,RIGHT]:
        rr(d,(r[0]-8,r[1]-8,r[2]+8,r[3]+8),'#dce1e8',18)
        rr(d,(r[0]-4,r[1]-4,r[2]+4,r[3]+4),'#222d3d',14)
    src=source(t)
    im.paste(src.resize((514,322),Image.Resampling.LANCZOS),LEFT[:2]);d=ImageDraw.Draw(im)
    # The selection is shown in the same coordinates as the source crop.
    x1=LEFT[0]+CROP[0]*514/640;y1=LEFT[1]+CROP[1]*322/400
    x2=LEFT[0]+CROP[2]*514/640;y2=LEFT[1]+CROP[3]*322/400
    if mode=='flow' and t<3.4:
        p=ease((t-1)/2)
        endx=x1+(x2-x1)*p;endy=y1+(y2-y1)*p
        if t>=1:
            shade=Image.new('RGBA',im.size,(0,0,0,0));sd=ImageDraw.Draw(shade)
            sd.rectangle(LEFT,fill=(23,35,62,70));sd.rectangle((x1,y1,endx,endy),fill=(55,101,236,35))
            im=Image.alpha_composite(im.convert('RGBA'),shade).convert('RGB');d=ImageDraw.Draw(im)
            d.rectangle((x1,y1,endx,endy),outline=BLUE,width=3)
        pointer(d,endx,endy)
    else:d.rectangle((x1,y1,x2,y2),outline=BLUE,width=3)
    if active:
        live=source(1.4 if frozen else t).crop(CROP)
        if drawing:ink_layer(live,drawing)
        im.paste(fit_view(live,scale),RIGHT[:2]);d=ImageDraw.Draw(im)
        d.line((577,345,624,345),fill=BLUE,width=3);d.polygon([(625,345),(615,339),(615,351)],fill=BLUE)
        rr(d,(1080,132,1162,162),'#ffffff',10,outline='#dce1e8')
        d.ellipse((1090,143,1097,150),fill='#b78028' if frozen else GREEN)
        text(d,(1106,136),'Frozen' if frozen else 'Live',14,color=INK,bold=True)
        rr(d,(RIGHT[0]+202,RIGHT[3]+10,RIGHT[0]+312,RIGHT[3]+40),'#ffffff',10,outline='#dce1e8')
        text(d,(RIGHT[0]+257,RIGHT[3]+14),f'-   {round(scale*100)}%   +',13,anchor='ma')
        if mode=='flow' and 7<t<9.4:
            a=2*math.pi*drawing
            pointer(d,RIGHT[0]+(336+34*math.cos(a))*514/464,RIGHT[1]+(166+87*math.sin(a))*322/286,True)
    else:
        rr(d,RIGHT,'#ffffff',0)
        text(d,(905,318),'Your selected area appears here',20,MUTED,anchor='mm')
        text(d,(905,351),'and keeps updating live.',16,MUTED,anchor='mm')
    d=ImageDraw.Draw(im)
    text(d,(40,550),'Ctrl + Alt + S',16,INK,True)
    text(d,(40,578),'Drag to choose the area.',16,MUTED)
    rightnote='The source is still running. Only this view is paused.' if frozen else 'Draw here. Keep working in the original app.'
    text(d,(648,550),rightnote,16,INK,True)
    text(d,(648,578),'Copy or save the view with your markup.',16,MUTED)
    text(d,(1162,635),'Workflow mockup',12,MUTED,anchor='ra')
    return im

# A shared palette keeps flat UI colors stable across frames.
previews=[render(2),render(8.9),render(12),render(2,'freeze')]
sheet=Image.new('RGB',(W*2,H*2))
for i,frame in enumerate(previews):sheet.paste(frame,((i%2)*W,(i//2)*H))
palette=sheet.quantize(colors=128)
for mode,seconds in [('flow',14),('zoom',6),('freeze',6)]:
    frames=[render(i/10,mode).quantize(palette=palette,dither=Image.Dither.NONE) for i in range(seconds*10)]
    target=OUT/({'flow':'live-region','zoom':'zoom-view','freeze':'freeze-frame'}[mode]+'.gif')
    frames[0].save(target,save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True,disposal=1)
    print(target.name,round(target.stat().st_size/1024),'KB',len(frames),'frames')
    del frames
# Storyboard for visual review, not used as a substitute for the GIF.
board=Image.new('RGB',(1200,660*4),BG)
for i,t in enumerate([2.2,5.5,9.5,12.5]):board.paste(render(t),(0,i*660))
(ROOT/'test-results').mkdir(exist_ok=True)
board.save(ROOT/'test-results'/'demo-storyboard.png')
