import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('key', Path(__file__).with_name('key-terrain-magenta.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class KeyTest(unittest.TestCase):
    def test_background_and_stone(self):
        self.assertEqual(module.key_pixel((255, 0, 255, 255)), (0, 0, 0, 0))
        self.assertEqual(module.key_pixel((180, 160, 120, 255)), (180, 160, 120, 255))
        self.assertEqual(module.key_pixel((80, 120, 60, 255)), (80, 120, 60, 255))
    def test_fringe_loses_magenta_without_a_transparent_veil(self):
        red, green, blue, alpha = module.key_pixel((180, 120, 152, 255))
        self.assertEqual(min(red, blue), green)
        self.assertEqual(alpha, 128)

if __name__ == '__main__':
    unittest.main()
