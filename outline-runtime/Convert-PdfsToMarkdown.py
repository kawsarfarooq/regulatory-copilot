from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "import"
OUTPUT_DIR = INPUT_DIR / "markdown"

TITLES = {
    "FDA_Cybersecurity_2026.pdf": "FDA Cybersecurity Guidance (2026)",
    "FDA_Device_Software_Premarket_2023.pdf": "FDA Device Software Premarket Guidance (2023)",
    "FDA_OTS_Software_2023.pdf": "FDA Off-The-Shelf Software Guidance (2023)",
}


def clean_page_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(?<=\w)-\n(?=[a-z])", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def convert(pdf_path: Path) -> tuple[Path, int, int]:
    reader = PdfReader(str(pdf_path))
    title = TITLES.get(pdf_path.name, pdf_path.stem.replace("_", " "))
    output_path = OUTPUT_DIR / f"{pdf_path.stem}.md"

    sections = [
        f"# {title}",
        "",
        f"Original source file: `{pdf_path.name}`",
        "",
        "This searchable copy preserves explicit PDF page markers for traceability.",
        "",
    ]

    character_count = 0
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = clean_page_text(page.extract_text() or "")
        character_count += len(page_text)
        sections.extend(
            [
                f"## PDF page {page_number}",
                "",
                page_text or "[No extractable text on this page]",
                "",
            ]
        )

    output_path.write_text("\n".join(sections), encoding="utf-8")
    return output_path, len(reader.pages), character_count


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf_paths = sorted(INPUT_DIR.glob("*.pdf"))
    if not pdf_paths:
        raise SystemExit(f"No PDFs found in {INPUT_DIR}")

    for pdf_path in pdf_paths:
        output_path, page_count, character_count = convert(pdf_path)
        print(
            f"{pdf_path.name} -> {output_path.name}: "
            f"{page_count} pages, {character_count} extracted characters"
        )


if __name__ == "__main__":
    main()
