import importlib.util
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('clean_alpha', Path(__file__).with_name('clean-terrain-alpha.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AlphaTest(unittest.TestCase):
    def test_removes_haze_preserves_rgb_and_does_not_mutate_source(self):
        image = Image.new('RGBA', (5, 1))
        image.putdata([(90, 120, 40, alpha) for alpha in [0, 63, 160, 192, 240]])
        cleaned = module.clean_alpha(image)
        self.assertEqual(list(cleaned.getchannel('A').tobytes()), [0, 0, 0, 128, 255])
        self.assertEqual(list(image.getchannel('A').tobytes()), [0, 63, 160, 192, 240])
        self.assertEqual(cleaned.convert('RGB').tobytes(), image.convert('RGB').tobytes())


if __name__ == '__main__':
    unittest.main()
