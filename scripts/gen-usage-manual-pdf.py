# -*- coding: utf-8 -*-
"""Generate ER-Think teacher/student usage manual PDF."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "ER-Think-使用手册-师生版.pdf"
TMP = ROOT / "tmp" / "pdfs"
FONT_PATH = Path(r"C:\Windows\Fonts\simhei.ttf")

BRAND = colors.HexColor("#0f766e")
BRAND_SOFT = colors.HexColor("#d8f3ef")
INK = colors.HexColor("#1a2e2a")
MUTED = colors.HexColor("#5c6f6a")
LINE = colors.HexColor("#d5e3df")
AMBER_BG = colors.HexColor("#fff4d9")
PANEL = colors.HexColor("#f4f8f7")


def register_fonts():
    if not FONT_PATH.exists():
        raise SystemExit(f"Chinese font not found: {FONT_PATH}")
    pdfmetrics.registerFont(TTFont("CN", str(FONT_PATH)))


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="CN",
            fontSize=26,
            leading=34,
            textColor=BRAND,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName="CN",
            fontSize=12,
            leading=18,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName="CN",
            fontSize=16,
            leading=22,
            textColor=BRAND,
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName="CN",
            fontSize=12.5,
            leading=18,
            textColor=INK,
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="CN",
            fontSize=9.5,
            leading=15,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="CN",
            fontSize=9.5,
            leading=15,
            textColor=INK,
            leftIndent=2,
        ),
        "small": ParagraphStyle(
            "small",
            fontName="CN",
            fontSize=8.5,
            leading=13,
            textColor=MUTED,
        ),
        "cell": ParagraphStyle(
            "cell",
            fontName="CN",
            fontSize=8.5,
            leading=12,
            textColor=INK,
        ),
        "cell_h": ParagraphStyle(
            "cell_h",
            fontName="CN",
            fontSize=8.5,
            leading=12,
            textColor=colors.white,
        ),
        "callout": ParagraphStyle(
            "callout",
            fontName="CN",
            fontSize=9,
            leading=14,
            textColor=INK,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName="CN",
            fontSize=8,
            leading=10,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "flow": ParagraphStyle(
            "flow",
            fontName="CN",
            fontSize=9,
            leading=14,
            textColor=INK,
            backColor=PANEL,
            borderPadding=6,
        ),
    }
    return s


def p(text, style):
    return Paragraph(str(text).replace("\n", "<br/>"), style)


def bullets(items, st):
    flow = []
    for item in items:
        flow.append(ListItem(Paragraph(item, st["bullet"]), leftIndent=12, bulletColor=BRAND))
    return ListFlowable(
        flow,
        bulletType="bullet",
        start="•",
        leftIndent=14,
        bulletFontName="CN",
        bulletFontSize=9,
        spaceBefore=2,
        spaceAfter=6,
    )


def make_table(headers, rows, col_widths, st):
    data = [[p(h, st["cell_h"]) for h in headers]]
    for row in rows:
        data.append([p(c, st["cell"]) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PANEL]),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def callout_box(title, body, st, bg=AMBER_BG):
    inner = Table(
        [[p(f"<b>{title}</b><br/>{body}", st["callout"])]],
        colWidths=[170 * mm],
    )
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.6, BRAND),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return inner


def flow_box(text, st):
    inner = Table([[p(text.replace("→", "→"), st["body"])]], colWidths=[170 * mm])
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PANEL),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return inner


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFont("CN", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8 * mm, "ER-Think 使用手册 · 教师版 / 学生版")
    canvas.drawRightString(A4[0] - 18 * mm, 8 * mm, f"{doc.page}")
    canvas.restoreState()


def build():
    register_fonts()
    TMP.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    st = styles()

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="ER-Think 使用手册（教师版 · 学生版）",
        author="ER-Think",
    )

    story = []

    # Cover
    story.append(Spacer(1, 28 * mm))
    story.append(p("ER-Think", st["cover_title"]))
    story.append(p("急诊临床思维训练系统", st["cover_sub"]))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="60%", thickness=2, color=BRAND, spaceBefore=4, spaceAfter=10))
    story.append(p("使用手册", st["cover_title"]))
    story.append(p("教师版 · 学生版", st["cover_sub"]))
    story.append(Spacer(1, 10 * mm))
    story.append(
        callout_box(
            "适用说明",
            "当前 Web 师生系统（Next.js）。验收主病例为 STEMI #03；另含 Demo 导入多病种病例。"
            "正式使用以三列训练台 + P1-P8 为准（非四阶段暗色 Demo）。",
            st,
            BRAND_SOFT,
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(
        make_table(
            ["角色", "用户名", "密码", "登录后"],
            [
                ["教师", "teacher", "Teacher123!", "教学看板"],
                ["学生", "student1", "Student123!", "开始训练"],
            ],
            [35 * mm, 40 * mm, 50 * mm, 45 * mm],
            st,
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(p("打开地址：http://localhost:5000（或部署 / Coze 预览域名）", st["small"]))
    story.append(p("登录页可一键填入演示账号。", st["small"]))
    story.append(PageBreak())

    # Section 1
    story.append(p("一、如何打开系统", st["h1"]))
    story.append(bullets(
        [
            "进入项目「代码」目录，配置 .env.local（至少 DATABASE_URL、SESSION_SECRET）。",
            "首次或病例更新后执行：npm run db:init（或 node scripts/run-init-from-env.mjs）。",
            "开发启动：npm run dev；生产：npm run build → npm start。",
            "浏览器打开 http://localhost:5000；未登录跳转登录页，登录后按角色进入首页。",
        ],
        st,
    ))

    # Teacher
    story.append(p("二、教师版怎么用", st["h1"]))
    story.append(p("顶栏：教学看板 | 病例导入 | 学生管理", st["body"]))

    story.append(p("1. 教学看板（日常主入口）", st["h2"]))
    story.append(p("路径：/dashboard · 用途：查看班级训练进度与成绩。", st["body"]))
    story.append(bullets(
        [
            "用状态（进行中/已完成）、结局 Path A-D、开始/结束日期筛选。",
            "查看统计：筛选范围内的记录数、已完成数。",
            "表格字段：学生、病例、状态、总分、结局、开始时间。",
            "点「详情」进入单次训练过程页（/sessions?id=…）：基本信息、六维得分条、决策记录、问诊覆盖、对话摘要。",
        ],
        st,
    ))
    story.append(
        callout_box(
            "说明",
            "教师详情侧重过程抽查；雷达图、路径对照、逐节点评语、导出 Word 在学生复盘与「我的记录」中更完整。",
            st,
        )
    )

    story.append(p("2. 病例导入与发布", st["h2"]))
    story.append(p("路径：/cases · 用途：导入病例 JSON，控制学生是否可见。", st["body"]))
    story.append(bullets(
        [
            "上传 JSON 或粘贴内容；可勾选「导入后立即对学生发布」。",
            "可用「载入 STEMI 模板副本」快速获得标准结构。",
            "列表中「发布 / 下架」：已发布=学生可见可练；下架=学生不可见。",
            "初始化后内置病例（含 stemi-03）一般为已发布；新导入请确认发布后再开练。",
        ],
        st,
    ))

    story.append(p("3. 学生管理", st["h2"]))
    story.append(p("路径：/students · 用途：维护本班学生账号。", st["body"]))
    story.append(bullets(
        [
            "新增：用户名、显示名、学号、初始密码。",
            "编辑：可改资料与密码。",
            "删除：会一并清理该生训练记录，操作前请确认。",
        ],
        st,
    ))

    story.append(p("4. 教师推荐工作流（课堂上）", st["h2"]))
    story.append(
        flow_box(
            "登录教师账号 → 学生管理建账号 → 病例导入确认 stemi-03 已发布 → "
            "学生开练 → 看板筛选巡课 → 详情抽查（ECG 时机、用药/策略、病情波动）→ "
            "课后按 Path / 总分讲评薄弱维度",
            st,
        )
    )

    story.append(PageBreak())

    # Student
    story.append(p("三、学生版怎么用", st["h1"]))
    story.append(p("顶栏：开始训练 | 我的记录", st["body"]))

    story.append(p("1. 选病例开练", st["h2"]))
    story.append(p("路径：/train", st["body"]))
    story.append(bullets(
        [
            "选择已发布病例（建议先练：急诊胸痛评估 · 急性前壁 STEMI / stemi-03）。",
            "若有未完成记录：可「继续上次」或「重新开始」。",
            "点「开始训练」进入训练台。",
        ],
        st,
    ))

    story.append(p("2. 训练台怎么操作", st["h2"]))
    story.append(p("<b>左侧</b>", st["body"]))
    story.append(bullets(
        [
            "病例卡：目标时长、模拟时钟 T+分钟、真实墙钟 MM:SS",
            "病情波进度：多波波动/恶化，结束前需走完",
            "六维能力实时累计；知识点卡片（辅助）；「结束演练并复盘」",
        ],
        st,
    ))
    story.append(p("<b>主区上方</b>：生命体征监护（随病情变黄/变红）", st["body"]))
    story.append(p("<b>三列工作区</b>", st["body"]))
    story.append(
        make_table(
            ["区域", "做什么"],
            [
                ["问诊对话", "上方快捷问句一点即问；也可手打。关键/安全信息有标记"],
                ["检查区", "查体点选（生命体征、心肺、双侧血压等）；再开立检验/心电图并等回报"],
                ["决策 P1-P8", "选节点写理由提交。P5 勾选药物；P6 点选再灌注策略"],
            ],
            [38 * mm, 132 * mm],
            st,
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(bullets(
        [
            "右下角 Toast：得分、超时、病情变化提醒",
            "「继续观察（推进 8 分钟）」：推进模拟时钟，可能触发病情变化",
            "出现病情波动/危急卡片时：先勾选处置再提交，才能继续问诊/决策",
        ],
        st,
    ))

    story.append(p("3. STEMI 建议操作顺序（对照验收）", st["h2"]))
    story.append(bullets(
        [
            "P1 分诊：II 级急症 / 胸痛绿色通道",
            "问诊 + 查体点选（生命体征、心肺、双侧血压等）",
            "10 分钟内开立心电图（超时会警告并影响结局）",
            "开立必要化验（如肌钙蛋白；勿因等化验耽误再灌注）",
            "P5 勾选抗栓等核心药并提交",
            "P6 选择「直接 PCI」等推荐策略并提交",
            "继续观察 / 推进时钟，按提示处置各波病情变化（含休克）",
            "补全 P2-P4、P7、P8 等节点理由",
            "点「结束演练并复盘」",
        ],
        st,
    ))

    story.append(p("4. 看复盘与导出", st["h2"]))
    story.append(bullets(
        [
            "总分 /100、结局 Path A-D",
            "六维雷达图；标准路径 vs 你的路径",
            "逐节点复盘评语（达标/待加强 + 依据）",
            "六维评语、建议、推荐强化模块",
            "导出复盘 → 下载 ER-Think复盘.doc",
        ],
        st,
    ))

    story.append(
        KeepTogether(
            [
                p("5. 我的记录", st["h2"]),
                p(
                    "路径：/history → 查看 → /history/detail?id=…　可再次查看成绩、雷达、路径对照、节点评语；已完成可再导出。",
                    st["body"],
                ),
                p("6. 学生推荐工作流", st["h2"]),
                flow_box(
                    "登录学生账号 → 开始训练选 stemi-03 → 问诊快捷键 + 查体点选 + 早做心电图 → "
                    "P5 勾药、P6 选直接 PCI → 处置病情波动走完全部波 → 结束演练看雷达/路径/节点评语 → "
                    "导出 Word → 我的记录复习薄弱节点",
                    st,
                ),
            ]
        )
    )

    # 四、师生对照 + FAQ 紧接学生流程，避免出现大面积留白页
    story.append(p("四、师生对照速查", st["h1"]))
    story.append(
        make_table(
            ["事项", "教师", "学生"],
            [
                ["登录后去哪", "教学看板", "开始训练"],
                ["管病例", "导入 / 发布 / 下架", "只能练已发布病例"],
                ["管账号", "学生增删改", "-"],
                ["看成绩", "看板筛选 + 详情抽查", "当场复盘 + 我的记录"],
                ["导出 Word", "无班级批量导出", "个人复盘 .doc"],
                ["练操作", "不进训练台（角色跳转）", "训练台全流程"],
            ],
            [38 * mm, 66 * mm, 66 * mm],
            st,
        )
    )

    story.append(p("五、常见问题", st["h1"]))
    faqs = [
        ("学生看不到病例？", "教师到「病例导入」确认该病例为「已发布」。"),
        ("点不了问诊/决策？", "先完成当前「病情变化」处置卡片。"),
        ("心电图超时？", "尽量在模拟 T+10 前开立心电图；超时会 Toast 警告并影响评分/结局。"),
        ("结束不了？", "本例若配置了多波病情变化，需处理完（或按规则走完）后再结束。"),
        (
            "教师想看完整复盘图？",
            "可让学生导出 Word，或在教师机用学生账号打开该次「我的记录」详情（勿混用课堂权限）。",
        ),
    ]
    for q, a in faqs:
        story.append(
            KeepTogether(
                [
                    p(f"<b>{q}</b>", st["body"]),
                    p(a, st["small"]),
                    Spacer(1, 2 * mm),
                ]
            )
        )

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=4, spaceAfter=8))
    story.append(
        p(
            "文档对应当前产品能力。四阶段暗色 Demo 仅作原型参考；正式使用以本 Web 三列训练台 + P1-P8 为准。",
            st["small"],
        )
    )

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"Wrote {OUT}")
    return OUT


if __name__ == "__main__":
    build()
