import json
from plagiarism import get_text_similarity, get_code_similarity
from ai_detector import detect_ai_content

def test_text_similarity():
    print("--- Testing Text Similarity ---")
    t1 = "FastAPI is a modern, fast (high-performance) web framework for building APIs with Python 3.8+ based on standard Python type hints. It is extremely fast and easy to use."
    t2 = "FastAPI is a fast, modern web framework for constructing APIs using Python. It is based on standard Python type annotations. It is very fast and straightforward."
    
    res = get_text_similarity(t1, t2)
    print(f"Cosine Similarity Score: {res['score']:.4f}")
    print(f"Number of Sentence Matches: {len(res['matches'])}")
    for m in res['matches']:
        print(f"  Match similarity: {m['similarity']:.2f}")
        print(f"  Source: '{m['source']['text']}'")
        print(f"  Target: '{m['target']['text']}'")
    assert res['score'] > 0.6
    print("Text similarity test passed!\n")

def test_code_similarity():
    print("--- Testing Code Winnowing Similarity ---")
    c1 = """
    def bubble_sort(arr):
        # Sort the given array using bubble sort helper
        n = len(arr)
        for i in range(n):
            for j in range(0, n-i-1):
                if arr[j] > arr[j+1]:
                    arr[j], arr[j+1] = arr[j+1], arr[j]
        return arr
    """
    
    # Renamed variables, changed comments, and split the swap operation
    c2 = """
    def sort_array(items):
        length = len(items)
        for step in range(length):
            for idx in range(0, length - step - 1):
                if items[idx] > items[idx + 1]:
                    temp = items[idx]
                    items[idx] = items[idx + 1]
                    items[idx + 1] = temp
        return items
    """
    
    res = get_code_similarity(c1, c2, k=6, w=4)
    print(f"Code Winnowing Score: {res['score']:.4f}")
    print(f"Number of Matching Substring Hashes: {len(res['matches'])}")
    # Print some matching characters
    if res['matches']:
        m = res['matches'][0]
        print(f"  Source Match snippet: '{m['source']['text'].strip()}'")
        print(f"  Target Match snippet: '{m['target']['text'].strip()}'")
    assert res['score'] > 0.4
    print("Code similarity test passed!\n")

def test_ai_detector_heuristics():
    print("--- Testing Offline AI Detector Heuristics ---")
    
    # Typical AI narrative pattern
    ai_text = (
        "Furthermore, it is important to note that the tapestry of technology delves into "
        "a beacon of hope. Seamless integration of dynamic paradigms allows us to leverage "
        "meticulously structured ecosystems. Consequently, we must analyze the crucial "
        "ramifications that ultimately redefine how we collaborate. In conclusion, this is "
        "a vital step towards a modern future."
    )
    
    # Typical casual human script
    human_text = (
        "Hi everyone! I wanted to write a quick note about how I built this server. "
        "I had a lot of issues setting up the libraries first. I looked online, "
        "found some cool scripts, copy pasted a bit, but then fixed it so it works. "
        "It was pretty hard but it's finally running fine now. Let me know what you think!"
    )
    
    ai_res = detect_ai_content(ai_text, is_code=False)
    human_res = detect_ai_content(human_text, is_code=False)
    
    print(f"AI Text Heuristic Score: {ai_res['score']}% (Method: {ai_res['method']})")
    print(f"Human Text Heuristic Score: {human_res['score']}% (Method: {human_res['method']})")
    print("AI detector heuristics test completed successfully!\n")

if __name__ == "__main__":
    test_text_similarity()
    test_code_similarity()
    test_ai_detector_heuristics()
    print("All tests completed successfully!")
