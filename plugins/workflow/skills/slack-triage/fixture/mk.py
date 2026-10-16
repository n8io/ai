from PIL import Image, ImageDraw, ImageFont
W,H=390,844
img=Image.new("RGB",(W,H),(18,18,20)); d=ImageDraw.Draw(img)
def f(sz,bold=False):
    p="/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"
    return ImageFont.truetype(p,sz)
# status bar
d.text((16,14),"9:41",font=f(14,True),fill=(240,240,240))
d.text((330,14),"84%",font=f(12),fill=(200,200,200))
# url bar
d.rounded_rectangle([12,40,378,74],10,fill=(38,38,42))
d.text((24,50),"exampleleague.app/rounds/aug-12-pebble/scorecard",font=f(11),fill=(170,170,176))
# header
d.text((16,96),"Round 4 · Pebble Creek",font=f(20,True),fill=(245,245,245))
d.text((16,124),"Blue tees · 72.4 / 131",font=f(12),fill=(150,150,156))
# table header
d.line([(16,152),(374,152)],fill=(60,60,66))
for x,t in ((16,"PLAYER"),(214,"HCP"),(276,"GROSS"),(330,"NET")):
    d.text((x,162),t,font=f(10,True),fill=(130,130,138))
rows=[("Dana Whitfield","8.2","91","83"),("Marcus Reed","14.6","98","83"),("Priya Nadkarni","+2.1","74","--"),("Tom Alvarez","21.3","104","83")]
y=186
for n,h,g,net in rows:
    bad = net=="--"
    if bad: d.rounded_rectangle([12,y-6,378,y+26],6,fill=(52,26,26))
    d.text((16,y),n,font=f(13,True),fill=(235,235,235))
    d.text((214,y),h,font=f(13),fill=(255,120,120) if bad else (200,200,206))
    d.text((276,y),g,font=f(13),fill=(200,200,206))
    d.text((330,y),net,font=f(13,True),fill=(255,120,120) if bad else (225,225,231))
    y+=44
# error toast
d.rounded_rectangle([12,y+18,378,y+96],10,fill=(58,22,22),outline=(150,60,60))
d.text((28,y+32),"Couldn't calculate net score",font=f(13,True),fill=(255,190,190))
d.text((28,y+54),"CORRUPT_ROW: handicapIndex \"+2.1\" is not",font=f(11),fill=(230,170,170))
d.text((28,y+70),"a valid number  (ref e7c31a)",font=f(11),fill=(230,170,170))
# footer nav
d.line([(0,H-72),(W,H-72)],fill=(50,50,56))
for x,t in ((34,"Home"),(126,"Play"),(226,"Standings"),(330,"You")):
    d.text((x,H-50),t,font=f(11),fill=(140,140,148))
img.save("screenshot-scorecard.png")
print("saved")
