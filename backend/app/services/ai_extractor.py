"""
AI 数据提取服务
支持多种文件类型：EndoPAT PDF, TCD PDF, Vicorder PDF, 血检报告，CGM CSV
支持多种 LLM 服务：Anthropic, OpenAI, DeepSeek, Moonshot(Kimi), 阿里云，SiliconFlow
"""
import base64
import os
from typing import Optional, Any
import pandas as pd
from anthropic import Anthropic
from openai import OpenAI

from app.core.config import settings


# ============== Prompt 模板 ==============

ENDO_PAT_PROMPT = """
你是一个医疗数据提取专家。请从这张 EndoPAT2000 检查报告 PDF 图片中提取以下数据：

需要提取的字段：
1. RHI 值 (Reactive Hyperemia Index) - 数字
2. AI 值 (Augmentation Index) - 百分比数字，不带%符号
3. AI@75bpm 值 - 百分比数字，不带%符号
4. Heart Rate (心率) - 数字
5. Test Date - 格式：YYYY-MM-DD
6. Systolic BP (收缩压) - 数字
7. Diastolic BP (舒张压) - 数字
8. Patient ID/编号 - 字符串
9. Age - 数字
10. Gender - "Male" 或 "Female"

请以 JSON 格式返回，只返回纯 JSON，不要有任何其他文字。格式如下：
{
    "rhi": 1.59,
    "ai": -4,
    "ai_at_75bpm": -21,
    "heart_rate": 49,
    "test_date": "2025-08-23",
    "systolic_bp": 99,
    "diastolic_bp": 58,
    "patient_id": "12",
    "age": 34,
    "gender": "Female"
}
"""

TCD_PROMPT = """
你是一个医疗数据提取专家。请从这张 TCD (经颅多普勒) 检查报告 PDF 图片中提取以下数据：

需要提取的字段：
1. 检查日期 - 格式：YYYY-MM-DD
2. 患者姓名
3. 性别 - "男" 或 "女"
4. 年龄 - 数字
5. 住院号 (如果有)
6. TCD 登录号

对于血管数据（可能是多条，每条血管包含以下字段）：
- 血管名称 (基底动脉/大脑中动脉/等)
- 深度 (mm)
- Vp (收缩峰流速，cm/s)
- Vm (平均流速，cm/s)
- Vd (舒张末期流速，cm/s)
- PI (搏动指数)
- RI (阻力指数)
- S/D (收缩/舒张比)
- HR (心率)

请以 JSON 格式返回，只返回纯 JSON，不要有任何其他文字。格式如下：
{
    "test_date": "2025-09-22",
    "patient_name": "张三",
    "gender": "女",
    "age": 30,
    "hospital_id": "",
    "tcd_id": "25092234",
    "vessels": [
        {
            "name": "基底动脉",
            "depth": 75,
            "vp": 63,
            "vm": 34,
            "vd": 24,
            "pi": 1.16,
            "ri": 0.62,
            "s_d": 2.63,
            "hr": 69
        }
    ]
}
"""

VICORDER_PROMPT = """
你是一个医疗数据提取专家。请从这张 Vicorder (PWV 脉波传导速度) 检查报告 PDF 图片中提取以下数据：

需要提取的字段：
1. 检查日期 - 格式：YYYY-MM-DD
2. 患者 ID/编号
3. 年龄
4. 性别
5. cfPWV (颈股动脉脉波传导速度，m/s)
6. 血压 (收缩压/舒张压)
7. 心率

请以 JSON 格式返回，只返回纯 JSON，不要有任何其他文字。格式如下：
{
    "test_date": "2025-01-15",
    "patient_id": "001",
    "age": 45,
    "gender": "Male",
    "cf_pwv": 8.5,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "heart_rate": 72
}
"""

BLOOD_TEST_PROMPT = """
你是一个医疗数据提取专家。请从这张血检报告 PDF 图片中提取以下数据：

需要提取的字段：
1. 检查日期 - 格式：YYYY-MM-DD
2. 患者姓名
3. 患者 ID/编号

对于每个检测项目，提取：
- 项目名称
- 结果值
- 单位
- 参考范围
- 是否异常（高于/低于正常范围）

常见检测项目包括但不限于：
- 空腹血糖 (FPG)
- 糖化血红蛋白 (HbA1c)
- 总胆固醇 (TC)
- 甘油三酯 (TG)
- 高密度脂蛋白 (HDL-C)
- 低密度脂蛋白 (LDL-C)
- 尿酸 (UA)
- 肌酐 (Cr)
- 等

请以 JSON 格式返回，只返回纯 JSON，不要有任何其他文字。格式如下：
{
    "test_date": "2025-01-15",
    "patient_name": "张三",
    "patient_id": "001",
    "items": [
        {
            "name": "空腹血糖",
            "value": 5.6,
            "unit": "mmol/L",
            "reference": "3.9-6.1",
            "is_abnormal": false
        },
        {
            "name": "糖化血红蛋白",
            "value": 6.8,
            "unit": "%",
            "reference": "4.0-6.0",
            "is_abnormal": true,
            "abnormal_direction": "high"
        }
    ]
}
"""


def encode_image_to_base64(file_path: str) -> str:
    """将文件编码为 base64"""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def pdf_to_image(file_path: str) -> Optional[str]:
    """
    将 PDF 转换为图片
    需要安装：pip install pdf2image pillow
    """
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(file_path, dpi=300)
        if images:
            # 保存第一页为临时图片
            import io
            buffer = io.BytesIO()
            images[0].save(buffer, format='PNG')
            buffer.seek(0)
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"PDF 转图片失败：{e}")
    return None


async def extract_with_anthropic(image_base64: str, prompt: str) -> Any:
    """使用 Anthropic Claude 进行视觉提取"""
    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )

    # 提取 JSON
    import re
    text = response.content[0].text
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        import json
        return json.loads(json_match.group())
    return None


async def extract_with_openai_compatible(image_base64: str, prompt: str, api_key: str, base_url: str, model: str) -> Any:
    """使用兼容 OpenAI 格式的 API 进行视觉提取（DeepSeek, Moonshot, 阿里云，SiliconFlow 等）"""
    client = OpenAI(api_key=api_key, base_url=base_url)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        }
                    }
                ]
            }
        ],
        max_tokens=2048,
    )

    # 提取 JSON
    import re
    text = response.choices[0].message.content
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        import json
        return json.loads(json_match.group())
    return None


async def extract_with_openai(image_base64: str, prompt: str) -> Any:
    """使用 OpenAI GPT-4o 进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.OPENAI_API_KEY,
        "https://api.openai.com/v1",
        settings.OPENAI_MODEL
    )


async def extract_with_deepseek(image_base64: str, prompt: str) -> Any:
    """使用 DeepSeek (深度求索) 进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.DEEPSEEK_API_KEY,
        settings.DEEPSEEK_BASE_URL,
        settings.DEEPSEEK_MODEL
    )


async def extract_with_moonshot(image_base64: str, prompt: str) -> Any:
    """使用 Moonshot (Kimi/月之暗面) 进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.MOONSHOT_API_KEY,
        settings.MOONSHOT_BASE_URL,
        settings.MOONSHOT_MODEL
    )


async def extract_with_aliyun(image_base64: str, prompt: str) -> Any:
    """使用阿里云通义千问进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.ALIYUN_API_KEY,
        settings.ALIYUN_BASE_URL,
        settings.ALIYUN_MODEL
    )


async def extract_with_siliconflow(image_base64: str, prompt: str) -> Any:
    """使用硅基流动进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.SILICONFLOW_API_KEY,
        settings.SILICONFLOW_BASE_URL,
        settings.SILICONFLOW_MODEL
    )


async def extract_with_custom(image_base64: str, prompt: str) -> Any:
    """使用自定义兼容 API 进行视觉提取"""
    return await extract_with_openai_compatible(
        image_base64,
        prompt,
        settings.CUSTOM_API_KEY,
        settings.CUSTOM_BASE_URL,
        settings.CUSTOM_MODEL or settings.CUSTOM_MODEL_NAME
    )


def generate_dynamic_prompt(file_type: str, fields: list) -> str:
    """
    根据模板字段动态生成 Prompt

    Args:
        file_type: 文件类型
        fields: 字段列表，每个字段包含 field_name, field_label, field_type

    Returns:
        动态生成的 Prompt 字符串
    """
    field_descriptions = []
    for f in fields:
        field_type_text = "数字" if f["field_type"] == "number" else "文本"
        field_descriptions.append(f"- {f['field_name']} ({f['field_label']}): {field_type_text}")

    fields_list = ", ".join([f'"{f["field_name"]}"' for f in fields])

    prompt = f"""你是一个医疗数据提取专家。请从这张 {file_type} 检查报告 PDF 图片中提取以下数据：

需要提取的字段（只提取以下字段）：
{chr(10).join(field_descriptions)}

注意事项：
1. 只提取上面列出的字段，不要提取其他多余的信息
2. 数字字段直接返回数值，不要带单位
3. 如果某个字段在报告中找不到，返回 null
4. 以 JSON 格式返回，只返回纯 JSON，不要有任何其他文字

返回的 JSON 应只包含以下键：{fields_list}
"""
    return prompt


async def extract_data_from_file(
    file_path: str,
    file_type: str,
    filename: str,
    template_fields: Optional[list] = None  # 模板字段列表，从数据库获取
) -> Optional[dict]:
    """
    根据文件类型调用相应的 AI 提取

    Args:
        file_path: 文件路径
        file_type: 文件类型 (EndoPAT, TCD, Vicorder, BloodTest)
        filename: 原始文件名
        template_fields: 模板字段列表，如果提供则使用动态 Prompt

    Returns:
        提取的结构化数据字典，如果提取失败则返回 None
    """
    # 生成 Prompt：如果有模板字段则使用动态 Prompt，否则使用预设 Prompt
    if template_fields:
        prompt = generate_dynamic_prompt(file_type, template_fields)
    else:
        prompt_map = {
            'EndoPAT': ENDO_PAT_PROMPT,
            'TCD': TCD_PROMPT,
            'Vicorder': VICORDER_PROMPT,
            'BloodTest': BLOOD_TEST_PROMPT,
        }
        prompt = prompt_map.get(file_type)

    if not prompt:
        print(f"不支持的文件类型：{file_type}")
        return None

    # PDF 文件需要转换为图片
    if file_path.lower().endswith('.pdf'):
        image_base64 = pdf_to_image(file_path)
        if not image_base64:
            # 如果 PDF 转图片失败，尝试直接读取 PDF 文本
            try:
                from pikepdf import Pdf
                pdf = Pdf.open(file_path)
                # 简单提取元数据
                return {"raw_filename": filename, "note": "需要 PDF 转图片服务"}
            except:
                return None
    elif file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
        image_base64 = encode_image_to_base64(file_path)
    else:
        print(f"不支持的文件格式：{file_path}")
        return None

    # 根据 LLM_PROVIDER 调用相应的 AI 服务
    provider = settings.LLM_PROVIDER.lower()

    if provider == "anthropic":
        return await extract_with_anthropic(image_base64, prompt)
    elif provider == "openai":
        return await extract_with_openai(image_base64, prompt)
    elif provider == "deepseek":
        return await extract_with_deepseek(image_base64, prompt)
    elif provider == "moonshot":
        return await extract_with_moonshot(image_base64, prompt)
    elif provider == "aliyun":
        return await extract_with_aliyun(image_base64, prompt)
    elif provider == "siliconflow":
        return await extract_with_siliconflow(image_base64, prompt)
    elif provider == "custom":
        return await extract_with_custom(image_base64, prompt)
    else:
        print(f"不支持的 LLM 提供商：{provider}")
        # 默认尝试 Anthropic
        return await extract_with_anthropic(image_base64, prompt)


def process_cgm_csv(file_path: str) -> dict:
    """
    处理 CGM (连续血糖监测) CSV/Excel 文件
    提取特征值并返回
    """
    try:
        if file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        # 假设列名为 'timestamp' 和 'glucose'，实际可能需要调整
        numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns

        features = {}
        for col in numeric_cols:
            values = df[col].dropna()
            if len(values) > 0:
                features[f"{col}_mean"] = float(values.mean())
                features[f"{col}_std"] = float(values.std())
                features[f"{col}_min"] = float(values.min())
                features[f"{col}_max"] = float(values.max())
                features[f"{col}_cv"] = float(values.std() / values.mean()) if values.mean() > 0 else 0

        # 时间范围
        if 'timestamp' in df.columns or 'time' in df.columns:
            time_col = 'timestamp' if 'timestamp' in df.columns else 'time'
            df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
            valid_times = df[time_col].dropna()
            if len(valid_times) > 0:
                features["start_time"] = str(valid_times.min())
                features["end_time"] = str(valid_times.max())
                features["duration_hours"] = (valid_times.max() - valid_times.min()).total_seconds() / 3600

        features["total_records"] = len(df)
        return features

    except Exception as e:
        print(f"CGM CSV 处理失败：{e}")
        return {"error": str(e)}
