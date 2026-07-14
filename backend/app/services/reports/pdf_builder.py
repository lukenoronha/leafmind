"""reportlab-based PDF rendering — isolated here so `ReportService` stays
testable without rendering real PDFs in every test, and so `reportlab`'s API
is only ever touched from this one module.
"""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.reports.schemas import EvaluationReportData, PredictionReportData

_STYLES = getSampleStyleSheet()
_DISCLAIMER_STYLE = ParagraphStyle(
    "Disclaimer", parent=_STYLES["Italic"], fontSize=8, textColor=colors.grey
)
_TABLE_HEADER_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e7d32")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]
)


def build_prediction_pdf(data: PredictionReportData) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=LETTER)
    story = []

    story.append(Paragraph("LeafMind Prediction Report", _STYLES["Title"]))
    story.append(Paragraph(f"Generated: {data.created_at.isoformat()}", _STYLES["Normal"]))
    story.append(Paragraph(data.disclaimer, _DISCLAIMER_STYLE))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("1. Prediction Details", _STYLES["Heading2"]))
    story.append(
        Paragraph(
            f"<b>Predicted species:</b> {data.predicted_label}<br/>"
            f"<b>Confidence:</b> {data.confidence:.2%}<br/>"
            f"<b>Source image:</b> {data.original_filename}",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 0.15 * inch))

    candidate_rows = [["Label", "Confidence", "Reasoning"]]
    for c in data.candidates:
        candidate_rows.append([c.label, f"{c.confidence:.2%}", c.reasoning or "-"])
    candidate_table = Table(candidate_rows, colWidths=[2 * inch, 1 * inch, 3.5 * inch])
    candidate_table.setStyle(_TABLE_HEADER_STYLE)
    story.append(candidate_table)
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("2. Model &amp; Timing", _STYLES["Heading2"]))
    story.append(
        Paragraph(
            f"<b>Model:</b> {data.model_name}<br/>"
            f"<b>Preprocessing time:</b> {data.preprocessing_ms:.1f} ms<br/>"
            f"<b>Inference time:</b> {data.inference_ms:.1f} ms",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("3. Related Knowledge Base Information", _STYLES["Heading2"]))
    if data.knowledge_available:
        for chunk in data.related_knowledge:
            source = chunk.document_name or "Unknown source"
            if chunk.page_number is not None:
                source += f", p. {chunk.page_number}"
            story.append(
                Paragraph(f"<b>Source:</b> {source} (similarity {chunk.score:.2f})", _STYLES["Normal"])
            )
            story.append(Paragraph(chunk.text[:800], _STYLES["Normal"]))
            story.append(Spacer(1, 0.1 * inch))
    else:
        story.append(
            Paragraph(
                "Medicinal information: not available in the knowledge base for this species.",
                _STYLES["Normal"],
            )
        )
    story.append(Spacer(1, 0.25 * inch))

    story.append(
        Paragraph(
            f"Report footer — Prediction ID: {data.prediction_id} | "
            f"Requested by: {data.user_email} | Generated: {data.created_at.isoformat()}",
            _DISCLAIMER_STYLE,
        )
    )

    doc.build(story)
    return buffer.getvalue()


def build_evaluation_pdf(run: EvaluationReportData) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=LETTER)
    story = []

    story.append(Paragraph("LeafMind Evaluation Report", _STYLES["Title"]))
    story.append(Paragraph(f"Generated: {run.created_at.isoformat()}", _STYLES["Normal"]))
    story.append(Paragraph(run.disclaimer, _DISCLAIMER_STYLE))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("1. Run Summary", _STYLES["Heading2"]))
    story.append(
        Paragraph(
            f"<b>Run type:</b> {run.run_type}<br/>"
            f"<b>Sample count:</b> {run.sample_count}<br/>"
            f"<b>Duration:</b> {run.duration_ms:.1f} ms<br/>"
            f"<b>Run ID:</b> {run.run_id}",
            _STYLES["Normal"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    if run.run_type == "classification":
        story.append(Paragraph("2. Classification Metrics", _STYLES["Heading2"]))
        metrics_rows = [
            ["Metric", "Value"],
            ["Accuracy", f"{run.metrics.get('accuracy', 0):.4f}"],
            ["Precision (macro)", f"{run.metrics.get('precision_macro', 0):.4f}"],
            ["Recall (macro)", f"{run.metrics.get('recall_macro', 0):.4f}"],
            ["F1 (macro)", f"{run.metrics.get('f1_macro', 0):.4f}"],
            ["Errors", str(run.metrics.get("errors_count", 0))],
        ]
        metrics_table = Table(metrics_rows, colWidths=[2.5 * inch, 2 * inch])
        metrics_table.setStyle(_TABLE_HEADER_STYLE)
        story.append(metrics_table)
        story.append(Spacer(1, 0.2 * inch))

        confusion_matrix = run.metrics.get("confusion_matrix")
        class_labels = run.class_labels or []
        if confusion_matrix and class_labels:
            story.append(Paragraph("Confusion Matrix", _STYLES["Heading3"]))
            header_row = [""] + class_labels
            cm_rows = [header_row]
            for label, row in zip(class_labels, confusion_matrix, strict=False):
                cm_rows.append([label] + [str(v) for v in row])
            cm_table = Table(cm_rows)
            cm_table.setStyle(_TABLE_HEADER_STYLE)
            story.append(cm_table)
    else:
        story.append(Paragraph("2. RAG Metrics", _STYLES["Heading2"]))
        rag_rows = [["Metric", "Value"]]
        for key, label in [
            ("avg_retrieval_ms", "Avg retrieval time (ms)"),
            ("median_retrieval_ms", "Median retrieval time (ms)"),
            ("p95_retrieval_ms", "P95 retrieval time (ms)"),
            ("avg_similarity_score", "Avg similarity score"),
            ("avg_retrieved_chunks", "Avg retrieved chunks"),
            ("zero_hit_rate", "Zero-hit rate"),
            ("context_relevance", "Context relevance"),
            ("citation_coverage", "Citation coverage"),
        ]:
            rag_rows.append([label, f"{run.metrics.get(key, 0)}"])
        rag_table = Table(rag_rows, colWidths=[3 * inch, 2 * inch])
        rag_table.setStyle(_TABLE_HEADER_STYLE)
        story.append(rag_table)

    doc.build(story)
    return buffer.getvalue()
