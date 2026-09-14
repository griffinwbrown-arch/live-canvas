from PIL import Image, ImageDraw
from pathlib import Path
out = Path(__file__).resolve().parent.parent / 'packaging'
out.mkdir(exist_ok=True)
im = Image.new('RGBA', (256,256), (0,0,0,0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((4,4,252,252),radius=48,fill='#234d40')
d.rounded_rectangle((46,54,210,192),radius=16,fill='#e1eee6')
d.rounded_rectangle((61,69,195,177),radius=5,fill='#f9fbf9')
d.line([(77,145),(107,114),(131,137),(179,91)],fill='#24513f',width=13)
d.ellipse((172,84,187,99),fill='#d6b578')
d.rounded_rectangle((90,209,166,219),radius=5,fill='#b1c8ba')
im.save(out/'icon.png')
im.save(out/'icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
