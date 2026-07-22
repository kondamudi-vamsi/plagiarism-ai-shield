import os
import re
import math
import json
from typing import Dict, List, Any, Tuple

# ==========================================
# Heuristic Text AI Detector
# ==========================================

AI_BUZZWORDS = {
    'delve', 'tapestry', 'testament', 'moreover', 'consequently', 'furthermore',
    'in conclusion', 'additionally', 'not only', 'but also', 'it is important to note',
    'crucial', 'essential', 'ultimately', 'demystify', 'seamless', 'leverage',
    'in summary', 'meticulously', 'beacon', 'vibrant', 'revolutionize'
}

def analyze_text_heuristics(text: str) -> Dict[str, Any]:
    """
    Analyzes writing style, sentence length distribution, and vocabulary variety
    to predict AI text generation likelihood without using an API.
    """
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    if not paragraphs:
        return {"score": 0.0, "details": {}, "paragraphs": []}

    overall_para_results = []
    total_score_weighted = 0.0
    total_len = 0

    for i, para in enumerate(paragraphs):
        para_score, para_details = _get_single_para_heuristic_score(para)
        weight = len(para)
        total_score_weighted += para_score * weight
        total_len += weight
        
        overall_para_results.append({
            "text": para,
            "score": float(para_score),
            "reasons": para_details["reasons"]
        })
        
    final_score = total_score_weighted / total_len if total_len > 0 else 0.0
    
    return {
        "score": float(round(final_score, 1)),
        "details": {
            "vocabulary_richness": "Normal" if final_score < 40 else "Repetitive (AI characteristic)",
            "sentence_length_uniformity": "Varied (Human-like)" if final_score < 45 else "Uniform (AI-like)"
        },
        "paragraphs": overall_para_results
    }

def _get_single_para_heuristic_score(para: str) -> Tuple[float, Dict[str, Any]]:
    """Evaluates a single snippet/paragraph returning a score from 0-100."""
    words = re.findall(r'\b\w+\b', para.lower())
    sentences = [s.strip() for s in re.split(r'[.!?]+', para) if s.strip()]
    
    if len(words) < 5:
        # Too short to judge
        return 20.0, {"reasons": ["Text is too short for reliable heuristic analysis."]}
        
    reasons = []
    score_components = []
    
    # 1. Type-Token Ratio (Vocabulary Richness)
    unique_words = set(words)
    ttr = len(unique_words) / len(words)
    # Human text has higher TTR. AI text reuses vocabulary, leading to lower TTR.
    # Standard human TTR on short paragraphs is ~0.75-0.90. Lower than 0.70 starts mapping to AI.
    if ttr < 0.65:
        score_components.append(80)
        reasons.append("Highly repetitive vocabulary usage.")
    elif ttr < 0.75:
        score_components.append(50)
        reasons.append("Somewhat repetitive vocabulary.")
    else:
        score_components.append(15)
        
    # 2. Sentence Length Variation (Burstiness)
    if len(sentences) >= 2:
        lengths = [len(s.split()) for s in sentences]
        mean_len = sum(lengths) / len(lengths)
        variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
        std_dev = math.sqrt(variance)
        
        # Human writing has high burstiness (e.g. standard deviation of sentence lengths > 5-6).
        # AI writing is very structurally regular (std_dev < 3).
        if std_dev < 2.5:
            score_components.append(75)
            reasons.append("Highly uniform sentence structure (low variation in sentence lengths).")
        elif std_dev < 4.5:
            score_components.append(45)
            reasons.append("Slightly uniform sentence structure.")
        else:
            score_components.append(10)
    else:
        # Only single sentence
        score_components.append(40)
        reasons.append("Lacks sentence variety (single sentence in paragraph).")
        
    # 3. Buzzwords/Marker checks
    buzz_count = sum(1 for w in words if w in AI_BUZZWORDS)
    buzz_ratio = buzz_count / len(words)
    if buzz_ratio > 0.05:
        score_components.append(90)
        reasons.append("Over-utilization of typical AI transitional words or phrasing.")
    elif buzz_ratio > 0.02:
        score_components.append(60)
        reasons.append("Contains multiple transition keywords frequently used by AI assistants.")
    else:
        score_components.append(10)
        
    avg_score = sum(score_components) / len(score_components)
    
    # Cap between 10 and 95 for heuristics
    avg_score = max(10.0, min(95.0, avg_score))
    
    if not reasons:
        reasons.append("Writing displays typical human-like grammatical variation and dynamic flow.")
        
    return avg_score, {"reasons": reasons}


# ==========================================
# Heuristic Code AI Detector
# ==========================================

def analyze_code_heuristics(code: str) -> Dict[str, Any]:
    """
    Analyzes code formatting patterns, comment statistics, and naming
    habits to estimate if code was AI-generated.
    """
    lines = [line.strip() for line in code.split('\n')]
    non_empty_lines = [l for l in lines if l]
    
    if len(non_empty_lines) < 4:
        return {
            "score": 30.0,
            "reasons": ["Code is too short to run comprehensive structure checks."],
            "details": {}
        }
        
    reasons = []
    score_components = []
    
    # 1. Comment Density
    comment_lines = 0
    in_block = False
    for line in lines:
        if '/*' in line or '"""' in line or "'''" in line:
            in_block = not in_block
            comment_lines += 1
            continue
        if in_block:
            comment_lines += 1
            continue
        if line.startswith('#') or line.startswith('//'):
            comment_lines += 1
            
    comment_ratio = comment_lines / len(non_empty_lines) if non_empty_lines else 0
    # AI code is usually heavily documented. Comment ratio > 0.35 indicates AI.
    if comment_ratio > 0.40:
        score_components.append(85)
        reasons.append("Excessive commenting density, characteristic of AI explanations.")
    elif comment_ratio > 0.25:
        score_components.append(60)
        reasons.append("Moderate warning: code contains comments detailed on nearly every block.")
    else:
        score_components.append(20)
        
    # 2. Identifier Length
    identifiers = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', code)
    custom_ids = [id_ for id_ in identifiers if len(id_) > 2 and id_ not in {
        'def', 'class', 'import', 'from', 'return', 'import', 'const', 'function', 'while', 'print', 'range'
    }]
    if custom_ids:
        avg_id_len = sum(len(x) for x in custom_ids) / len(custom_ids)
        # AI models generate variables with highly verbose, self-documenting naming (average > 10.5 chars).
        # Humans tend to use shorter names, contractions, or generic single-char iterators.
        if avg_id_len > 12.0:
            score_components.append(80)
            reasons.append("Highly descriptive, verbose identifier names (e.g. average identifier length is long).")
        elif avg_id_len < 6.0:
            score_components.append(15)
            # reasons.append("Short variable names, typical of human programmers.")
        else:
            score_components.append(40)
    else:
        score_components.append(30)

    # 3. Naming consistency
    snake_cases = sum(1 for id_ in custom_ids if '_' in id_ and not id_.startswith('_') and not id_.endswith('_'))
    camel_cases = sum(1 for id_ in custom_ids if any(c.isupper() for c in id_[1:-1]) and '_' not in id_)
    total_styled = snake_cases + camel_cases
    if total_styled > 5:
        consistency = max(snake_cases, camel_cases) / total_styled
        # LLMs generate incredibly consistent casing. Humans fluctuate, especially in larger scripts.
        if consistency > 0.98:
            score_components.append(70)
            reasons.append("Flawless variable naming consistency (100% strict style adherence).")
        elif consistency < 0.75:
            score_components.append(20)
            reasons.append("Dynamic variable naming conventions with mixed camelCase/snake_case (highly human-like).")
        else:
            score_components.append(40)
    else:
        score_components.append(30)
        
    final_score = sum(score_components) / len(score_components)
    final_score = max(10, min(90, final_score))
    
    if not reasons:
        reasons.append("Code structure matches standard community layout and variable naming profiles.")
        
    return {
        "score": float(round(final_score, 1)),
        "reasons": reasons,
        "details": {
            "comment_ratio": f"{round(comment_ratio * 100)}%",
            "avg_var_length": f"{round(avg_id_len, 1)} chars" if custom_ids else "N/A"
        }
    }


# ==========================================
# Gemini API AI Classifier (Text & Code)
# ==========================================

def analyze_via_gemini_api(content: str, is_code: bool = False) -> Dict[str, Any]:
    """
    Submits content (text script or source code) to Gemini for advanced
    semantic AI/Human authorship categorization.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "API Key not found in environment", "fallback": True}
        
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        
        # Fast, cost-efficient model for quick analysis
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        content_type = "source code" if is_code else "English text/script"
        
        prompt = f"""
        You are a highly advanced AI plagiarism and AI authorship analysis engine.
        Inspect the following {content_type} and determine the probability and confidence that it was generated by an AI language model vs. written by a human.
        
        Provide the response STRICTLY as a valid JSON object in the following format:
        {{
          "ai_probability": <0-100 float value representing percent likelihood of AI creation>,
          "confidence": <0-100 float value representing analysis certainty>,
          "explanation": "<give a comprehensive explanation focusing on style, syntax, formatting, comments, and boilerplate patterns>",
          "highlights": [
             {{
               "text": "<exact string from the text representing matching span>",
               "score": <0-100 float of AI probability for this block>,
               "reason": "<short description why this segment is/isn't human>"
             }}
          ]
        }}
        
        Here is the content to analyze:
        ---
        {content}
        ---
        
        CRITICAL instruction: Output ONLY the raw JSON block. No ```json markdown markings or commentary outside the JSON block.
        """
        
        response = model.generate_content(prompt)
        resp_text = response.text.strip()
        
        # Clean any markdown packaging
        if resp_text.startswith("```"):
            resp_text = re.sub(r'^```(?:json)?\n', '', resp_text)
            resp_text = re.sub(r'\n```$', '', resp_text).strip()
            
        result = json.loads(resp_text)
        return {
            "score": float(result.get("ai_probability", 50.0)),
            "confidence": float(result.get("confidence", 80.0)),
            "explanation": result.get("explanation", "AI models usually output boilerplate structures and descriptions."),
            "highlights": result.get("highlights", []),
            "fallback": False
        }
    except Exception as e:
        return {"error": f"Gemini API failure: {str(e)}", "fallback": True}


def detect_ai_content(content: str, is_code: bool = False) -> Dict[str, Any]:
    """
    Public entry point for AI detection. Orchestrates Gemini API query
    and falls back to local heuristic metrics if API keys are absent or fail.
    """
    # 1. Attempt Gemini Analysis
    gemini_result = analyze_via_gemini_api(content, is_code)
    
    if not gemini_result.get("fallback", False):
        return {
            "score": gemini_result["score"],
            "method": "Gemini API Analysis",
            "confidence": gemini_result["confidence"],
            "explanation": gemini_result["explanation"],
            "highlights": gemini_result["highlights"]
        }
        
    # 2. Fallback to Local Heuristics
    if is_code:
        heur = analyze_code_heuristics(content)
        # Create dummy highlights for entire file segments since heuristics are file-wide
        return {
            "score": heur["score"],
            "method": "Local Heuristics (Fallback)",
            "confidence": 70.0,
            "explanation": "Could not access Gemini API. Ran offline code heuristic parsing looking at documentation density, identifier lengths, and stylistic conventions.\n\n" + "\n".join(heur["reasons"]),
            "highlights": []
        }
    else:
        heur = analyze_text_heuristics(content)
        # Convert paragraph scores to highlight objects
        highlights = []
        for p in heur["paragraphs"]:
            highlights.append({
                "text": p["text"],
                "score": p["score"],
                "reason": "; ".join(p["reasons"])
            })
            
        return {
            "score": heur["score"],
            "method": "Local Heuristics (Fallback)",
            "confidence": 75.0,
            "explanation": "Could not access Gemini API. Conducted style-frequency metrics analyzing sentence length standard deviation (burstiness) and vocabulary richness (type-token index).",
            "highlights": highlights
        }
