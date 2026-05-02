from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from PIL import Image

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "mobilenetv2_best.keras")

class_names = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy', 'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot', 'Peach___healthy',
    'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy', 'Potato___Early_blight',
    'Potato___Late_blight', 'Potato___healthy', 'Raspberry___healthy', 'Soybean___healthy',
    'Squash___Powdery_mildew', 'Strawberry___Leaf_scorch', 'Strawberry___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight', 'Tomato___Leaf_Mold',
    'Tomato___Septoria_leaf_spot', 'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy'
]

# Multilingual translations (English, Hindi, Marathi, Tamil, Telugu) - 100% Offline
translations = {
    'Apple_scab': {'en': 'Apple Scab', 'hi': 'सेब स्काब', 'mr': 'सोवा स्कॅब', 'ta': 'ஆப்பிள் ஸ்கேப்', 'te': 'యాపిల్ స్కాబ్'},
    'Black_rot': {'en': 'Black Rot', 'hi': 'काला विगलन', 'mr': 'काळा विणन', 'ta': 'கருப்பு சிதைவு', 'te': 'నల్ల క్షయం'},
    'Cedar_apple_rust': {'en': 'Cedar Apple Rust', 'hi': 'सीडर सेब जंग', 'mr': 'सीडर सेब गंज', 'ta': 'சிடார் ஆப்பிள் துரு', 'te': 'సీడర్ యాపిల్ నిబ్బర్'},
    'healthy': {'en': 'Healthy', 'hi': 'स्वस्थ', 'mr': 'निरोगी', 'ta': 'ஆரோக்கியமான', 'te': 'ఆరోగ్యకరమైన'},
    'Powdery_mildew': {'en': 'Powdery Mildew', 'hi': 'पाउडरी मिल्ड्यू', 'mr': 'पावडरी मिल्ड्यू', 'ta': 'தூள் பூஞ்சை', 'te': 'పొడి పుండ్రం'},
    'Cercospora_leaf_spot': {'en': 'Cercospora Leaf Spot', 'hi': 'सरकोस्पोरा पत्ती धब्बा', 'mr': 'सरकोस्पोरा पान डाग', 'ta': 'சர்கோஸ்போரா இலை புள்ளி', 'te': 'సర్కోస్పోరా ఆకు మచ్చ'},
    'Common_rust': {'en': 'Common Rust', 'hi': 'साधारण जंग', 'mr': 'साधारण गंज', 'ta': 'பொதுவான துரு', 'te': 'సాధారణ నిబ్బర్'},
    'Northern_Leaf_Blight': {'en': 'Northern Leaf Blight', 'hi': 'उत्तरी पत्ती झुलसा', 'mr': 'उत्तरी पान झुलसा', 'ta': 'வடக்கு இலை கத்தி', 'te': 'ఉత్తర ఆకు కాలిక'},
    'Esca_Black_Measles': {'en': 'Black Measles (Esca)', 'hi': 'काली खसरा', 'mr': 'काळे मिझल्स', 'ta': 'கருப்பு தட்டம்பு', 'te': 'నల్ల పసుపు'},
    'Leaf_blight': {'en': 'Leaf Blight', 'hi': 'पत्ती झुलसा', 'mr': 'पान झुलसा', 'ta': 'இலை கத்தி', 'te': 'ఆకు కాలిక'},
    'Haunglongbing': {'en': 'Citrus Greening', 'hi': 'साइट्रस हरित रोग', 'mr': 'साइट्रस हरितरोग', 'ta': 'சிட்రஸ் பச்சை நோய்', 'te': 'సిట్రస్ ఆకతాలు'},
    'Bacterial_spot': {'en': 'Bacterial Spot', 'hi': 'बैक्टीरियल धब्बा', 'mr': 'बॅक्टेरियल डाग', 'ta': 'பாக்டீரியல் புள்ளி', 'te': 'బాక్టీరియల్ మచ్చ'},
    'Early_blight': {'en': 'Early Blight', 'hi': 'प्रारंभिक झुलसा', 'mr': 'आगाऊ झुलसा', 'ta': 'ஆரம்ப கத்தி', 'te': 'ప్రారంభ కాలిక'},
    'Late_blight': {'en': 'Late Blight', 'hi': 'देर से झुलसा', 'mr': 'उशिरा झुलसा', 'ta': 'தாமத கத்தி', 'te': 'ఆలస్య కాలిక'},
    'Leaf_Mold': {'en': 'Leaf Mold', 'hi': 'पत्ती सड़न', 'mr': 'पान चिंब', 'ta': 'இலை பூஞ்சை', 'te': 'ఆకు పుండ్రం'},
    'Septoria_leaf_spot': {'en': 'Septoria Leaf Spot', 'hi': 'सेप्टोरिया पत्ती धब्बा', 'mr': 'सेप्टोरिया पान डाग', 'ta': 'செப்டோரியா இலை புள்ளி', 'te': 'సెప్టోరియా ఆకు మచ్చ'},
    'Spider_mites': {'en': 'Spider Mites', 'hi': 'मकड़ी घुन', 'mr': 'मकडी पडळ', 'ta': 'சிலந்தி பூச்சி', 'te': 'చిలుక గుబ్బ'},
    'Target_Spot': {'en': 'Target Spot', 'hi': 'लक्ष्य धब्बा', 'mr': 'लक्ष्य डाग', 'ta': 'இலக்கு புள்ளி', 'te': 'లక్ష్య మచ్చ'},
    'Tomato_Yellow_Leaf_Curl_Virus': {'en': 'Tomato Yellow Leaf Curl', 'hi': 'टमाटर पीला पत्ती कर्ल', 'mr': 'टमाटर पिवळ पान वक्र', 'ta': 'தக்காளி மஞ்சள் இலை வளைத', 'te': 'టమోటా పసుపు ఆకు సవ్వింపు'},
    'Tomato_mosaic_virus': {'en': 'Tomato Mosaic Virus', 'hi': 'टमाटर मोजैक वायरस', 'mr': 'टमाटर मोजॅक व्हायरस', 'ta': 'தக்காளி பதுமை வைரஸ்', 'te': 'టమోటా చిత్ర వైరస్'},
}

app = Flask(__name__)
CORS(app)

model = tf.keras.models.load_model(MODEL_PATH)

IMG_SIZE = 224

def extract_disease_key(class_name):
    """Extract disease key from class name format 'Plant___Disease'"""
    if '___' in class_name:
        return class_name.split('___')[1]
    return class_name

def get_translated_name(english_disease, language='en'):
    """Get disease name in requested language (en, hi, mr, ta, te)"""
    language = language.lower() if language else 'en'
    if language not in ['en', 'hi', 'mr', 'ta', 'te']:
        language = 'en'
    
    # Try exact match first
    if english_disease in translations:
        return translations[english_disease][language]
    
    # Try partial match for complex disease names
    for key in translations.keys():
        if key in english_disease or english_disease in key:
            return translations[key][language]
    
    # Fallback: return English name
    return english_disease

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files["file"]
    language = request.form.get('language', 'en').lower()
    
    # Validate language
    if language not in ['en', 'hi', 'mr', 'ta', 'te']:
        language = 'en'

    img = Image.open(file.stream).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)

    predictions = model.predict(img_array)[0]

    predicted_index = int(np.argmax(predictions))
    predicted_disease_raw = class_names[predicted_index]
    disease_key = extract_disease_key(predicted_disease_raw)
    predicted_disease = get_translated_name(disease_key, language)
    confidence = float(predictions[predicted_index])

    top3_indices = predictions.argsort()[-3:][::-1]

    top3 = [
        {
            "disease": get_translated_name(extract_disease_key(class_names[int(i)]), language),
            "englishDisease": extract_disease_key(class_names[int(i)]),
            "probability": float(predictions[i])
        }
        for i in top3_indices
    ]

    return jsonify({
        "disease": predicted_disease,
        "englishDisease": disease_key,
        "confidence": confidence,
        "language": language,
        "top3": top3
    })

@app.route("/languages", methods=["GET"])
def get_languages():
    """Return supported languages"""
    return jsonify({
        "supported_languages": {
            "en": "English",
            "hi": "हिंदी (Hindi)",
            "mr": "मराठी (Marathi)",
            "ta": "தமிழ் (Tamil)",
            "te": "తెలుగు (Telugu)"
        }
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)