import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

styles = getSampleStyleSheet()
h1 = ParagraphStyle('h1', parent=styles['Heading1'], fontSize=14)
h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontSize=12)
body = styles['BodyText']

doc = SimpleDocTemplate("/tmp/medicinal_properties.pdf", pagesize=letter,
                        topMargin=0.75*inch, bottomMargin=0.75*inch)
story = []

with open(sys.argv[1], encoding='utf-8') as f:
    text = f.read()

blocks = text.split("================================================================================")
for block in blocks:
    block = block.strip()
    if not block:
        continue
    lines = block.split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            story.append(Spacer(1, 8))
            continue
        if line.startswith("## "):
            story.append(Paragraph(line[3:], h2))
        elif line.isupper() is False and len(line) < 80 and (line.endswith(":") is False) and lines.index(line) == 0:
            story.append(Paragraph(line, h1))
        else:
            story.append(Paragraph(line, body))
    story.append(Spacer(1, 16))

doc.build(story)
print("PDF generated")
