#!/usr/bin/env python3
"""Create sample package for standalone reader"""
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def create_sample_page():
    """Create a simple sample exam page"""
    width, height = 800, 1100
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
        font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except:
        font_large = ImageFont.load_default()
        font = font_large
        font_small = font_large
    
    draw.text((width/2, 30), "샘플 전기이론 (예시 데이터)", fill='black', font=font_large, anchor='mt')
    
    questions = [
        ("1. 저항 R=10Ω에 전류 I=2A가 흐를 때 소비전력 P[W]는?", 
         ["① 20", "② 40", "③ 5", "④ 200"], (40, 90)),
        ("2. 직렬로 연결된 4Ω, 6Ω 저항의 합성저항[Ω]은?",
         ["① 2.4", "② 10", "③ 24", "④ 1.5"], (440, 90)),
        ("3. 병렬로 연결된 6Ω, 3Ω 저항의 합성저항[Ω]은?",
         ["① 9", "② 4.5", "③ 2", "④ 18"], (40, 330)),
    ]
    
    for q_text, choices, pos in questions:
        x, y = pos
        draw.text((x, y), q_text, fill='black', font=font)
        for i, choice in enumerate(choices):
            draw.text((x + 20, y + 30 + i * 25), choice, fill='black', font=font_small)
    
    return img

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def main():
    build_dir = Path('content/sample')
    out_dir = Path('apps/reader-standalone/public')
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Create page images
    pages_dir = build_dir / 'pages'
    for size_dir in ['xs', 'sm', 'hi']:
        (pages_dir / size_dir).mkdir(parents=True, exist_ok=True)
    
    img = create_sample_page()
    
    # Save different sizes
    img_xs = img.resize((320, 440))
    img_sm = img.resize((600, 825))
    img_hi = img
    
    img_xs.save(pages_dir / 'xs' / '1.webp', 'WEBP', quality=80)
    img_sm.save(pages_dir / 'sm' / '1.webp', 'WEBP', quality=85)
    img_hi.save(pages_dir / 'hi' / '1.webp', 'WEBP', quality=90)
    
    book = json.loads((build_dir / 'book.json').read_text())
    pages = json.loads((build_dir / 'pages.json').read_text())
    quizzes = json.loads((build_dir / 'quizzes.json').read_text())
    
    files_to_include = [
        'book.json', 'pages.json', 'regions.json', 
        'quizzes.json', 'solutions.json', 'video_map.json'
    ]
    
    files = {}
    for f in files_to_include:
        path = build_dir / f
        if path.exists():
            files[f] = sha256(path.read_bytes())
    
    for page in pages:
        for size in ['xs', 'sm', 'hi']:
            p = build_dir / page['files'][size]
            if p.exists():
                files[page['files'][size]] = sha256(p.read_bytes())
    
    item = {
        "schema": "ipitem/1",
        "type": "ebook-video",
        "id": book['id'],
        "version": "1.0.0",
        "title": book['title'],
        "exam": book['exam'],
        "subject": book['subject'],
        "year": book['year'],
        "stats": {
            "pages": len(pages),
            "quizzes": len(quizzes),
            "videos": 3,
            "solutions": 3
        },
        "createdAt": datetime.now(timezone.utc).isoformat(timespec='seconds'),
        "files": files
    }
    
    zip_path = out_dir / 'sample-electric-2026-1.0.0.hsbpkg.zip'
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('item.json', json.dumps(item, ensure_ascii=False, indent=2))
        
        for f in files_to_include:
            path = build_dir / f
            if path.exists():
                zf.write(path, f)
        
        for page in pages:
            for size in ['xs', 'sm', 'hi']:
                p = build_dir / page['files'][size]
                if p.exists():
                    zf.write(p, page['files'][size], compress_type=zipfile.ZIP_STORED)
    
    print(f"Created {zip_path} ({zip_path.stat().st_size // 1024} KB)")

if __name__ == '__main__':
    main()
