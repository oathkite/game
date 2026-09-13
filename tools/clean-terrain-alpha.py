"""Remove low-alpha matte residue while retaining a narrow antialiased edge.

Usage: python3 tools/clean-terrain-alpha.py source.png destination.png
RGB detail and native dimensions are preserved; this is not an upscaler.
"""
import sys
from PIL import Image


def clean_alpha(image):
    result = image.convert('RGBA').copy()
    # Match the collision import threshold. Fully opaque interiors avoid scenery
    # bleeding through rock; the short transition retains edge antialiasing.
    table = [round(255 * min(1, max(0, (value - 160) / 64))) for value in range(256)]
    result.putalpha(result.getchannel('A').point(table))
    return result


if __name__ == '__main__':
    clean_alpha(Image.open(sys.argv[1])).save(sys.argv[2])
