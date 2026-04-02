# 队列研究多模态数据中台 - 项目文档

## 目录

1. [数据采集规范 (SOP for Collectors)](#1-数据采集规范-sop-for-collectors)
2. [数据审核规范 (SOP for Clerks)](#2-数据审核规范-sop-for-clerks)
3. [分析者使用规范 (SOP for Analysts)](#3-分析者使用规范-sop-for-analysts)
4. [管理员操作手册](#4-管理员操作手册)
5. [常见问题解答](#5-常见问题解答)

---

## 1. 数据采集规范 (SOP for Collectors)

### 1.1 文件命名规范

所有上传的文件必须遵循以下命名规则：

```
[受试者 ID]_[随访波次]_[检查项目]_[日期].pdf
```

**示例：**
- `041_V1_EndoPAT_20250516.pdf`
- `128_Baseline_TCD_20250101.pdf`
- `007_V3_BloodTest_20250315.pdf`

### 1.2 受试者信息录入

1. **受试者编号 (subject_code)**
   - 使用 3 位数字，不足补零，如 `001`, `041`, `128`
   - 确保编号唯一，与研究名册一致

2. **姓名拼音 (name_pinyin)**
   - 录入姓名拼音缩写，如 `zhangsan`, `lisi`
   - 仅用于辅助识别，不作为主要标识

3. **性别**
   - 选择「男」或「女」

4. **出生日期**
   - 格式：YYYY-MM-DD
   - 如不确定，可填写估计年份

5. **入组日期**
   - 受试者加入研究的日期
   - 可选填

### 1.3 随访记录创建

1. **选择随访类型**
   - `Baseline` - 基线访视
   - `V1` - 1 月随访
   - `V3` - 3 月随访
   - `V6` - 6 月随访
   - `V12` - 12 月随访
   - `Other` - 其他

2. **随访日期**
   - 实际进行检查的日期
   - 格式：YYYY-MM-DD

### 1.4 文件上传

1. 在「随访」页面找到对应记录
2. 点击「上传」按钮
3. 选择文件类型（报告种类）
4. 选择 PDF 或 CSV 文件
5. 等待上传完成（AI 会自动开始提取）

### 1.5 脱敏原则

- **仪器端录入**：尽量不在仪器上录入患者真实姓名，使用 ID 编号
- **文件导出**：导出 PDF 时选择不包含患者全名的选项
- **隐私保护**：统一使用内部编号，避免泄露隐私

### 1.6 可穿戴设备数据导出要求

1. **时间格式统一**
   - 必须为 `YYYY-MM-DD HH:MM:SS`
   - 不要在 Excel 中二次编辑导致时间格式错乱

2. **CSV 格式**
   - 第一行为列名：`timestamp,glucose`（或其他指标名）
   - 时间戳与数据一一对应

---

## 2. 数据审核规范 (SOP for Clerks)

### 2.1 审核流程

1. 访问「随访」页面
2. 找到状态为「待审核」的记录
3. 点击「审核」按钮进入审核界面

### 2.2 审核界面说明

审核界面分为左右两部分：
- **左侧**：原始 PDF 预览（如支持）
- **右侧**：AI 提取的结构化数据

### 2.3 人工校验底线

以下关键指标必须与原件视觉核对：

| 检查类型 | 必核对指标 |
|----------|-----------|
| EndoPAT | RHI 值、AI@75bpm |
| TCD | 各血管 Vp、Vm、PI、RI |
| Vicorder | cfPWV 值 |
| BloodTest | 所有检测项目结果值 |

### 2.4 异常情况处理

1. **AI 提取错误**
   - 如系统支持编辑，手动修正后保存
   - 如不支持，标记为「待复核」并记录问题

2. **数据极度异常**
   - 如舒张压 > 200 mmHg、RHI > 5 等
   - 在前端标记为「待复核」
   - 通知研究者最终裁定

3. **文件质量问题**
   - PDF 模糊、缺页、无法识别
   - 重新扫描或联系采集员

### 2.5 审核通过

1. 确认所有数据无误
2. 点击「确认入库」按钮
3. 数据正式存入数据库，可供导出

---

## 3. 分析者使用规范 (SOP for Analysts)

### 3.1 数据获取方式

**方式一：网页导出**
1. 访问「导出」页面
2. 设置筛选条件（可选）
3. 点击「导出 CSV」或「导出 Excel」

**方式二：API 访问**
1. 联系管理员获取 API Token
2. 使用 Python/R 调用 API 获取数据

### 3.2 数据格式说明

导出的宽表格式如下：

| subject_code | name_pinyin | gender | visit_name | visit_date | EndoPAT_rhi | EndoPAT_ai_at_75bpm | TCD_基底动脉_vp | ... |
|--------------|-------------|--------|------------|------------|-------------|---------------------|-----------------|-----|
| 041 | zhangsan | 男 | Baseline | 2025-01-15 | 1.59 | -21 | 63 | ... |
| 041 | zhangsan | 男 | V1 | 2025-02-15 | 1.72 | -18 | 65 | ... |

### 3.3 多模态时间对齐

**重要**：可穿戴设备的连续时间戳需要与临床检测时间点对齐。

**Python 示例：**
```python
import pandas as pd

# 读取导出数据和 CGM 原始数据
cohort_df = pd.read_csv('cohort_export.csv')
cgm_df = pd.read_csv('data_glu_raw.csv')

# 转换时间格式
cohort_df['visit_date'] = pd.to_datetime(cohort_df['visit_date'])
cgm_df['timestamp'] = pd.to_datetime(cgm_df['timestamp'])

# 时间窗对齐（前后 3 天）
aligned = pd.merge_asof(
    cgm_df.sort_values('timestamp'),
    cohort_df.sort_values('visit_date'),
    left_on='timestamp',
    right_on='visit_date',
    tolerance=pd.Timedelta('3D'),
    direction='nearest'
)
```

**R 示例：**
```r
library(dplyr)
library(lubridate)

# 读取数据
cohort_df <- read.csv('cohort_export.csv')
cgm_df <- read.csv('data_glu_raw.csv')

# 转换时间
cohort_df$visit_date <- ymd(cohort_df$visit_date)
cgm_df$timestamp <- ymd_hms(cgm_df$timestamp)

# 时间窗对齐
aligned <- cgm_df %>%
  arrange(timestamp) %>%
  join_by_nearest(visit_date, cohort_df, tolerance = days(3))
```

### 3.4 数据清洗原则

1. **禁止直接修改导出文件**
   - 绝对禁止在导出的 Excel 中手动删改行
   - 所有操作必须通过代码完成

2. **代码追溯**
   - 所有 R/Python 脚本必须通过 Git 版本控制
   - 确保所有清洗步骤可重复

3. **缺失值处理**
   - 记录缺失原因（未采集/AI 提取失败/审核驳回）
   - 在分析代码中明确插补方法

### 3.5 只读原则

- 分析者**只能**通过导出功能或只读 API 获取数据
- **禁止**直接连接生产数据库进行写操作
- **禁止**修改数据库中的原始记录

---

## 4. 管理员操作手册

### 4.1 用户管理

创建新用户（需要数据库权限）：

```sql
INSERT INTO users (username, email, hashed_password, role, is_active)
VALUES (
  'newuser',
  'user@example.com',
  '$2b$12$...',  -- bcrypt 加密后的密码
  'analyst',    -- admin/clerk/analyst/reviewer
  true
);
```

或使用 Python 生成密码哈希：

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("your_password")
print(hashed)
```

### 4.2 角色权限说明

| 角色 | 权限 |
|------|------|
| admin | 全部权限，包括用户管理、系统配置 |
| clerk | 上传文件、初步审核 |
| reviewer | 审核确认数据 |
| analyst | 查看和导出数据 |

### 4.3 数据库备份

```bash
# 使用 pg_dump 备份
pg_dump cohort_db > backup_$(date +%Y%m%d).sql

# 恢复
psql cohort_db < backup_20250115.sql
```

### 4.4 日志查看

后端日志位于 `backend/logs/` 目录，包含：
- API 访问日志
- AI 提取日志
- 错误日志

---

## 5. 常见问题解答

### Q1: AI 提取不准确怎么办？

**A:** AI 提取基于视觉识别，可能受到以下影响：
- PDF 质量差（模糊、倾斜、手写）
- 报告格式特殊（非标准模板）
- 指标位置不典型

解决方法：
1. 人工审核时手动修正
2. 对于格式特殊的报告，可联系开发人员添加自定义 Prompt

### Q2: 上传文件失败怎么办？

**A:** 检查以下事项：
1. 文件大小是否超过限制（默认 50MB）
2. 文件格式是否支持（.pdf, .csv, .xlsx）
3. 存储空间是否充足
4. 网络连接是否正常

### Q3: 如何添加新的检查类型？

**A:** 需要修改后端代码：
1. 在 `app/models/tables.py` 添加新的 FileType 枚举
2. 在 `app/services/ai_extractor.py` 添加新的 Prompt 模板
3. 在前端 `upload/page.tsx` 添加选项

### Q4: 数据导出为空？

**A:** 可能原因：
1. 筛选条件过严，无符合条件的数据
2. 数据尚未审核（仅导出已审核数据）
3. 数据库连接问题

### Q5: 如何修改 AI 提取的指标？

**A:** 编辑 `backend/app/services/ai_extractor.py` 中的 Prompt 模板：
```python
ENDO_PAT_PROMPT = """
...
需要提取的字段：
1. RHI 值 - 数字
2. AI 值 - 百分比
...添加新指标...
"""
```

---

## 附录：文件类型与提取字段对照表

| 文件类型 | 提取字段 |
|----------|----------|
| EndoPAT | RHI, AI, AI@75bpm, Heart Rate, Test Date, Systolic BP, Diastolic BP, Patient ID, Age, Gender |
| TCD | 检查日期，患者姓名，性别，年龄，住院号，TCD 登录号，各血管深度/Vp/Vm/Vd/PI/RI/S-D/HR |
| Vicorder | 检查日期，患者 ID, 年龄，性别，cfPWV, 血压，心率 |
| BloodTest | 检查日期，患者姓名，患者 ID, 各检测项目（名称/结果/单位/参考范围/是否异常） |

---

文档版本：1.0
最后更新：2025-01-15
