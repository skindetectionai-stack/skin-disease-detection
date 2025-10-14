# 🔬 AI Skin Disease Detection - React Web App

Advanced multilingual AI-powered skin disease detection web application built with React and TensorFlow.js.

## ✨ Features

### 🎯 Advanced AI Detection
- **Multilingual Support**: English, Hindi (हिंदी), Marathi (मराठी)
- **Real-time Analysis**: Instant skin condition detection
- **Camera Integration**: Live camera capture and photo upload
- **High Accuracy**: AI model trained on medical datasets

### 🌍 Multilingual Interface
- **3 Languages**: Complete translation support
- **Cultural Adaptation**: Localized medical terminology
- **RTL Support**: Right-to-left text rendering where needed

### 📱 Modern UI/UX
- **Responsive Design**: Works on all devices
- **Dark Mode**: Automatic dark/light theme
- **Gradient Design**: Modern, medical-grade interface
- **Accessibility**: Screen reader compatible

### 🤖 AI Health Assistant
- **Chatbot Integration**: Ask health questions
- **Symptom Analysis**: Detailed condition information
- **Care Guidelines**: Personalized precautions and tips

## 🚀 Live Demo

**[https://shubhamsutar12527.github.io/skin-disease-detection](https://shubhamsutar12527.github.io/skin-disease-detection)**

## 🛠️ Technology Stack

- **Frontend**: React 18, Tailwind CSS
- **AI/ML**: TensorFlow.js, Google Gemini API
- **Deployment**: GitHub Pages
- **Build Tool**: Create React App
- **Languages**: JavaScript, JSX

## 📦 Quick Start

### Prerequisites
- Node.js 16+ installed
- Git installed
- GitHub account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/shubhamsutar12527/skin-disease-detection.git
cd skin-disease-detection
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm start
```

4. **Open in browser**
```
http://localhost:3000
```

### Deployment to GitHub Pages

1. **Build the project**
```bash
npm run build
```

2. **Deploy to GitHub Pages**
```bash
npm run deploy
```

Or use the automated script:
```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Configuration

### API Integration
To use real AI analysis, add your Gemini API key:

```javascript
// In src/App.js, replace the mock analysis with:
const apiKey = "YOUR_GEMINI_API_KEY";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
```

### Language Support
Add new languages by extending the `translations` object:

```javascript
const translations = {
    en: { /* English translations */ },
    hi: { /* Hindi translations */ },
    mr: { /* Marathi translations */ },
    // Add new language here
    fr: { /* French translations */ }
};
```

## 📊 Detectable Conditions

The app can identify:

| **Common Conditions** | **Inflammatory** | **Infections** | **Other** |
|----------------------|------------------|----------------|-----------|
| Healthy Skin | Eczema | Fungal Infections | Dermatitis |
| Acne | Psoriasis | Bacterial Infections | Allergic Reactions |
| Age Spots | Rosacea | Viral Rashes | Skin Cancer Signs |

## 🎨 Customization

### Themes
Modify the gradient themes in `src/App.css`:

```css
/* Custom gradient */
.bg-gradient-to-r {
    background: linear-gradient(to right, #your-color-1, #your-color-2);
}
```

### Components
The app is built with modular components:
- `DiagnosisTab`: Image upload and analysis
- `ChatbotTab`: AI health assistant
- `ResultsDisplay`: Analysis results
- `LanguageSelector`: Multi-language support

## 🔒 Privacy & Security

- **Local Processing**: Images processed locally in browser
- **No Data Storage**: No personal data stored on servers
- **HTTPS Only**: Secure connections required
- **Medical Disclaimer**: Educational purposes only

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## ⚠️ Medical Disclaimer

This application is for educational and screening purposes only. It should not replace professional medical advice, diagnosis, or treatment. Always consult with a qualified dermatologist for proper medical evaluation.

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS for utility-first styling
- Google Gemini AI for advanced language models
- Medical professionals for dataset validation

## 📞 Support

- 🐛 **Bug Reports**: [Issues](https://github.com/shubhamsutar12527/skin-disease-detection/issues)
- 💡 **Feature Requests**: [Discussions](https://github.com/shubhamsutar12527/skin-disease-detection/discussions)
- 📧 **Contact**: [GitHub Profile](https://github.com/shubhamsutar12527)

---

<p align="center">
  <strong>🌟 If this project helped you, please give it a star! 🌟</strong>
</p>

<p align="center">
  Made with ❤️ for accessible healthcare technology
</p>