"""Regression checks for hosted cache updates and the offline bundle; standard library only."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import shutil
import subprocess
import sys
import tempfile
import unittest


class ResourceParser(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.urls = {}
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        url = attributes.get('src') if tag == 'script' else attributes.get('href') if tag == 'link' else None
        if url:
            self.urls[urlsplit(url).path] = url


class BuildTests(unittest.TestCase):
    def test_asset_changes_get_new_urls_and_the_standalone_stays_offline(self):
        source = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(prefix='fallout-planner-build-') as temporary:
            project = Path(temporary)
            for name in ['build-standalone.py', 'index.html', 'styles.css', 'tree.css', 'pipboy.css',
                         'data.js', 'fallout1-data.js', 'mechanics.js', 'engine.js', 'app.js']:
                shutil.copyfile(source / name, project / name)
            for directory in ['assets', 'branding']:
                shutil.copytree(source / directory, project / directory)

            def build():
                subprocess.run([sys.executable, str(project / 'build-standalone.py')],
                               check=True, capture_output=True)
                return (project / 'index.html').read_text(encoding='utf-8'), (project / 'Fallout2-Planner.html').read_text(encoding='utf-8')

            initial_page, initial_standalone = build()
            initial_urls = ResourceParser(initial_page).urls
            self.assertEqual(len(initial_urls), 8)
            self.assertTrue(all(urlsplit(url).query for url in initial_urls.values()))
            self.assertEqual(ResourceParser(initial_standalone).urls, {})

            with (project / 'app.js').open('a', encoding='utf-8') as script:
                script.write('\n// cache-version-regression\n')
            changed_page, changed_standalone = build()
            changed_urls = ResourceParser(changed_page).urls
            self.assertNotEqual(changed_urls['app.js'], initial_urls['app.js'])
            for name in initial_urls.keys() - {'app.js'}:
                self.assertEqual(changed_urls[name], initial_urls[name])
            self.assertEqual(ResourceParser(changed_standalone).urls, {})
            self.assertIn('// cache-version-regression', changed_standalone)
            self.assertEqual(build(), (changed_page, changed_standalone))


if __name__ == '__main__':
    unittest.main()
