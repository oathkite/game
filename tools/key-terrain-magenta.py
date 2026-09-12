"""Remove the deliberately uniform magenta backdrop from generated terrain.
Usage: python3 tools/key-terrain-magenta.py source.png destination.png
Only for assets explicitly generated without pink/purple foreground colors.
"""
import sys
from PIL import Image


def key_pixel(pixel):
    red, green, blue, alpha = pixel
    spill = max(0, min(red, blue) - green)
    if spill >= 64:
        return (0, 0, 0, 0)
    if spill == 0:
        return pixel
    return (red - spill, green, blue - spill, round(alpha * (1 - spill / 64)))


def key_image(image):
    source = image.convert('RGBA')
    result = Image.new('RGBA', source.size)
    result.putdata([key_pixel(pixel) for pixel in zip(*[iter(source.tobytes())] * 4)])
    return result


if __name__ == '__main__':
    key_image(Image.open(sys.argv[1])).save(sys.argv[2])
