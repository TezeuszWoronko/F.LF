from PIL import Image
import sys


for f_name in sys.argv[1:]:
    try:
        img = Image.open(f_name)
        img = img.convert("RGBA")

        pixdata = img.load()
        for y in range(img.size[1]):
            for x in range(img.size[0]):
                if pixdata[x, y] == (0, 0, 0, 255):
                    pixdata[x, y] = (0, 0, 0, 0)

        f_name_repalced = f_name.replace('.bmp', '.png')
        img.save(f_name_repalced)
    except:
        print('error', f_name)

