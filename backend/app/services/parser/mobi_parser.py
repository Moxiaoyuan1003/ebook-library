from pathlib import Path

from app.services.parser.base import BaseParser, ParsedBook


class MOBIParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".mobi"

    def parse(self, file_path: str) -> ParsedBook:
        try:
            import mobi

            tempdir, filepath = mobi.extract(file_path)
            html_path = Path(tempdir) / "mobi7" / "book.html"

            if not html_path.exists():
                # Try mobi8
                html_files = list(Path(tempdir).rglob("*.html"))
                if html_files:
                    html_path = html_files[0]
                else:
                    raise FileNotFoundError("No HTML content found in MOBI file")

            from bs4 import BeautifulSoup

            html_content = html_path.read_text(encoding="utf-8")
            soup = BeautifulSoup(html_content, "html.parser")
            text = soup.get_text(separator="\n", strip=True)

            # Cleanup
            import shutil

            shutil.rmtree(tempdir, ignore_errors=True)

            metadata = {
                "title": Path(file_path).stem,
                "author": "",
                "isbn": "",
                "publisher": "",
            }

            return ParsedBook(
                metadata=metadata,
                chapters=[{"title": "Full Text", "content": text, "page_start": 1, "page_end": 1}],
                full_text=text,
                page_count=1,
                cover_image=None,
            )
        except ImportError:
            # Fallback: try to read as ZIP containing HTML
            return self._fallback_parse(file_path)

    def _fallback_parse(self, file_path: str) -> ParsedBook:
        """Fallback parser for MOBI files when mobi library is unavailable."""
        import zipfile

        from bs4 import BeautifulSoup

        try:
            with zipfile.ZipFile(file_path, "r") as z:
                html_files = [f for f in z.namelist() if f.endswith(".html")]
                if html_files:
                    html_content = z.read(html_files[0]).decode("utf-8", errors="replace")
                    soup = BeautifulSoup(html_content, "html.parser")
                    text = soup.get_text(separator="\n", strip=True)
                else:
                    text = Path(file_path).read_text(encoding="utf-8", errors="replace")
        except Exception:
            text = ""

        metadata = {
            "title": Path(file_path).stem,
            "author": "",
            "isbn": "",
            "publisher": "",
        }

        return ParsedBook(
            metadata=metadata,
            chapters=[{"title": "Full Text", "content": text, "page_start": 1, "page_end": 1}],
            full_text=text,
            page_count=1,
            cover_image=None,
        )
