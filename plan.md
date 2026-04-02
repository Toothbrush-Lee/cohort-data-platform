我们组做了很多队列研究，会采集许多数据，包括上述所有的demo原始数据RHI，TCD，PWV数据，要从pdf中提取数据，还有需要从血检报告单中提取的标注物浓度数据，还有从可穿戴设备、环境床干起中的时间序列数据.过去我们的管理方法很原始，采用手动录入等工作，现在我希望建构一个数据中台，后端用OSS存原始数据，将提取出来的数据自动调用ocr或者LLM，存入sql数据库（需要符合几次随访实验设计、然后多模态数据的整理），之后可以简单从中很简单提取数据给分析者用R/python处理和统计。前端要有一个让录入员录入的网页，之后还需要有完整的文档介绍我这个项目，并规范采集员和分析者的。你是一个极为资深，并且善用现代技术的架构师，请你为我写一个plan，并且实现一个完整的需求文档，并且想象最好架构，之后我将用vibe coding工具来实现此平台。

🚀 队列研究多模态数据中台 (Cohort Data Platform) 架构设计

1. 技术栈推荐
前端 (Web UI): Next.js (React) + Tailwind CSS + Shadcn/ui（极度适合 AI 自动生成美观界面的组合）。

后端 (API & AI Pipeline): FastAPI (Python)。因为涉及 OCR、LLM 解析、处理时间序列（Pandas），Python 是绝对的主力。

数据库 (Database):

PostgreSQL: 核心业务库。使用 JSONB 字段存储非结构化提取结果，使用表结构管理随访设计。

Redis (可选): 用于异步任务队列。

对象存储 (OSS): 阿里云 OSS / 腾讯云 COS / AWS S3（或者开源的 MinIO 用于本地部署）。

AI 提取引擎:

OCR: PaddleOCR 或直接调用多模态大模型。

LLM 结构化: 统一封装 OpenAI GPT-4o / Claude 3.5 Sonnet / 智谱 GLM-4V 的 API，使用 Structured Outputs（强校验 JSON 输出）。

2. 核心系统架构图 (逻辑概念)
Plaintext
[录入员/前端界面] 
       │ 1. 上传 PDF (RHI/TCD/PWV/血检) & CSV (可穿戴)
       ▼
[API 网关 / FastAPI] ── 2. 存入原始文件 ──▶ [OSS 对象存储] (按 受试者ID/随访波次 归档)
       │
       │ 3. 触发异步任务 (Celery/BackgroundTasks)
       ▼
[AI 数据提取管道 (Pipeline)]
       ├─▶ PDF路由 ──▶ LLM 视觉大模型提取 ──▶ 结构化 JSON (如 RHI=1.59, AI@75bpm=-6%)
       ├─▶ CSV路由 ──▶ Pandas 预处理 ──▶ 数据清洗与重采样
       └─▶ 血检路由 ──▶ OCR + LLM ──▶ 提取生物标志物浓度
       │
       │ 4. 数据校验与落库
       ▼
[PostgreSQL 数据库] 
  (表设计：受试者 Subject -> 随访 Visit -> 检查项目 Assessment -> 具体指标)
       │
       │ 5. 提供数据查询与导出
       ▼
[分析者 (R/Python)] ◀── 调用 API 获取 DataFrame / 前端一键导出 CSV/Parquet 
📄 产品需求文档 (PRD)
核心业务逻辑 (多次随访设计)
所有数据必须挂载在以下层级之下，避免数据孤岛：
项目 (Project) -> 受试者 (Subject) -> 随访波次 (Visit: V1, V2...) -> 检查类型 (Assessment) -> 数据负载 (Payload)

模块 1: 录入员前端 (Data Ingestion Portal)
登录与权限: 基于角色的访问控制 (RBAC) - 录入员、审核员、分析员、管理员。

受试者管理台: 录入、查询受试者基本信息（ID, 姓名拼音缩写, 出生年月, 性别）。

随访文件上传舱:

选择受试者 -> 选择随访波次（如 Baseline, 3-Month, 6-Month）。

拖拽上传多文件（支持 .pdf, .csv, .xlsx）。

前端直传 OSS 或通过后端中转，展示上传进度条。

AI 提取审核台 (Human-in-the-Loop):

痛点解决: AI 提取不可能 100% 准确，必须有审核确认环节。

界面设计: 左侧预览原始 PDF/图表，右侧显示 LLM 提取出来的表单（如 TCD 的基底动脉 Vp=64, Vm=35 等）。

操作: 录入员检查无误后，点击“确认入库”；如有误，可手动修改并保存。

模块 2: 后端与 AI 处理管道 (Backend & Pipeline)
文件解析工厂 (Parser Factory): 根据文件名或文件头自动识别报告类型（Endo-PAT, Vicorder, TCD, 动态血糖等）。

LLM Prompt 模板库: 针对不同仪器报告，预设精细的 Prompt，要求强制输出特定 Schema 的 JSON。

例如针对 41邵宇诚_V1.pdf: 提取 RHI (1.59), AI@75bpm (-6%), Test Date 等。

时间序列处理: 针对可穿戴设备数据（如你上传的 data_glu_raw.csv），后端需要读取长序列，提取特征（如平均值、变异系数、最大/最小值），并将原始大文件 URL 存入库中，不把时间序列的每一行都塞进关系型数据库。

模块 3: 队列数据管理与导出前端 (Data Management & Export)
大宽表视图 (Cohort Data Grid): 按受试者和随访波次，展示拼接后的所有指标，类似 SPSS/Excel 的变量视图。

一键导出: 筛选条件后，导出为结构化 CSV、Excel 或 Parquet 文件，供 R/Python 直接 read_csv()。

API Token 管理: 给分析师生成只读的 API Token，允许他们用 Python 脚本直接拉取特定队列的数据。

🛠️ 数据库核心模型建议 (Schema Design)
在 Vibe Coding 时，把这段结构丢给 AI，它会立刻为你写出完美的 SQLAlchemy 或 Prisma 代码：

Subject (受试者表): id, subject_code (唯一编码，如 41), demographics (JSONB, 性别/出生日期等)。

Visit (随访记录表): id, subject_id, visit_name (如 'Baseline', 'V1'), visit_date。

RawFile (原始文件表): id, visit_id, file_type (TCD/RHI/GLU), oss_url, upload_time, status (已上传/解析中/待审核/已入库)。

AssessmentData (结构化数据表):

id, visit_id, file_id

assessment_type (如 'EndoPAT', 'TCD', 'Vicorder', 'BloodTest')

extracted_data (JSONB类型，存放 LLM 提取的全部键值对，这保证了极大的扩展性，未来加新指标不用改表结构)

is_verified (布尔值，录入员是否已核对)。

🚀 实施计划 (Vibe Coding Roadmap)
使用 Cursor 等工具时，不要一次性让 AI 写整个系统。按以下提示词（Prompts）分步骤进行：

阶段 1：脚手架搭建与数据库 (Day 1)
AI Prompt: "Create a FastAPI project. Set up SQLAlchemy with PostgreSQL. Create the following models: Subject, Visit, RawFile, AssessmentData. Use Pydantic schemas for data validation."

测试: 确保能通过 Swagger UI (FastAPI 自带) 进行基本的 CRUD。

阶段 2：OSS 与文件解析管道 (Day 2-3)
AI Prompt: "Add an upload endpoint in FastAPI. Write a service to upload files to a local directory (or MinIO/S3). Write a background task mechanism (using asyncio or BackgroundTasks) that takes a PDF file, sends it to the OpenAI API (or compatible LLM vision API), and extracts data based on a defined Pydantic model for an 'EndoPAT' report. Return structured JSON."

测试: 丢入一张你上传的 PDF，看后端是否能准确吐出包含 RHI、血压、AI指数的 JSON。

阶段 3：前端录入台与人机交互 (Day 4-5)
AI Prompt: "Create a Next.js (App router) frontend with Tailwind and Shadcn UI. Build a layout with a sidebar. Create a 'Subject Upload' page where a user can select a subject, a visit wave, and upload a file. Create a 'Verification' view that splits the screen: left side shows the PDF (using an iframe or pdf.js), right side shows a form auto-filled with JSON data from the backend API. Allow the user to edit the form and submit."

阶段 4：导出与数据宽表 (Day 6)
AI Prompt: "In FastAPI, write an endpoint that joins Subject, Visit, and AssessmentData. Flatten the JSONB data into a wide table format using Pandas. Create an endpoint that returns a downloadable CSV file. In Next.js, add a 'Data Export' page with filters and a download button."

📜 项目规范文档 (Governance Guidelines)
为了你的系统长治久安，在系统中以及日常管理中必须确立以下规范：

1. 数据采集与命名规范 (SOP for Collectors)
文件命名必须规范化：虽然 AI 能解析，但最好强制规定文件命名，如 [受试者ID]_[随访波次]_[检查项目]_[日期].pdf (例：041_V1_EndoPAT_20250516.pdf)。

脱敏原则：尽量不在仪器上录入患者真实姓名，使用 ID 编号（如你上传的 TCD 文件中，姓名为 wangzhi3，建议统一使用内部编号，避免泄露隐私）。

可穿戴设备导出要求：确保导出的 CSV 格式统一，不要在 Excel 里二次编辑导致时间格式错乱（必须统一为 YYYY-MM-DD HH:MM:SS）。

2. 数据审核与入库规范 (SOP for Clerks)
人工校验底线：血检标志物浓度、关键终点指标（如 RHI, PWV）的 AI 提取结果，录入员必须与原件 PDF 视觉核对 1 遍。

异常值标记：如果发现提取的数据极度异常（如舒张压 > 200），录入员需在前端标记为“待复核”，由研究者最终裁定。

3. 分析者使用规范 (SOP for Analysts)
禁止直连生产数据库写操作：分析者只能通过导出的只读 CSV 或者只读 API/SQL 账号拉取数据。

多模态时间对齐：提醒分析者，可穿戴设备的连续时间戳（如 data_glu_raw.csv）需要与临床检测的时间点（Visit Date）在 R/Python 中利用 Pandas 的 merge_asof 或类似时间窗操作进行对齐。

代码追溯：分析者处理数据的 R/Python 脚本必须通过 Git 版本控制，确保所有的“数据清洗”步骤（如剔除极值、填补缺失值）是可重复的，绝对禁止直接在导出的 Excel 里面手动删改行。
