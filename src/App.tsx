/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wand2, 
  BookOpen, 
  Scroll, 
  GraduationCap, 
  Zap, 
  Volume2, 
  CheckCircle2, 
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Plus,
  Camera,
  X,
  Upload,
  Bird,
  Heart,
  Cookie
} from 'lucide-react';
import { generateWizardContent, WordDetail, recognizeWordsFromImage } from './lib/gemini';
import { WordProgress, calculateNextReview, OwlStats } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'input' | 'story' | 'library' | 'dictation' | 'quiz' | 'owl'>('input');
  const [inputWords, setInputWords] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [progress, setProgress] = useState<WordProgress[]>(() => {
    const saved = localStorage.getItem('wizard_progress');
    return saved ? JSON.parse(saved) : [];
  });
  const [owlStats, setOwlStats] = useState<OwlStats>(() => {
    const saved = localStorage.getItem('wizard_owl_stats');
    return saved ? JSON.parse(saved) : {
      name: 'Hedwig',
      level: 1,
      experience: 0,
      hunger: 50,
      totalMagic: 0
    };
  });
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationInput, setDictationInput] = useState('');
  const [dictationResult, setDictationResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const [selectedWord, setSelectedWord] = useState<WordDetail | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<number, 'correct' | 'wrong' | null>>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('wizard_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('wizard_owl_stats', JSON.stringify(owlStats));
  }, [owlStats]);

  const playWandSound = () => {
    // Simulate magic wand sound with a visual sparkle effect or audio if available
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => console.log("Audio play blocked"));
  };

  const handleStartMagic = async (wordsToUse?: string[]) => {
    const finalWords = wordsToUse || inputWords.split(/[,，\s]+/).filter(w => w.length > 0);
    if (finalWords.length === 0) return;
    
    // Check if API key is set
    const hasKey = !!(import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.VITE_OPENROUTER_API_KEY || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY));
    
    if (!hasKey) {
      alert("魔法咒语失效了！\n\n请在 Vercel 环境变量中设置:\nVITE_GEMINI_API_KEY 或 VITE_OPENROUTER_API_KEY\n\n设置后记得重新部署(Redeploy)哦！");
      return;
    }

    // Add words to library immediately (without details yet)
    const initialProgress = [...progress];
    finalWords.forEach(w => {
      const normalized = w.toLowerCase().trim();
      const existingIdx = initialProgress.findIndex(p => p.word.toLowerCase() === normalized);
      if (existingIdx === -1) {
        initialProgress.push({
          word: normalized,
          magicValue: 50,
          lastReview: Date.now(),
          nextReview: calculateNextReview(0),
          correctCount: 0,
          isMastered: false
        });
      }
    });
    setProgress(initialProgress);

    setIsLoading(true);
    try {
      const data = await generateWizardContent(finalWords);
      setSessionData(data);
      
      // Update progress with details
      const newProgress = [...initialProgress];
      finalWords.forEach(w => {
        const normalized = w.toLowerCase().trim();
        const detail = data.wordDetails.find((d: any) => d.word.toLowerCase() === normalized);
        const existingIdx = newProgress.findIndex(p => p.word.toLowerCase() === normalized);
        
        if (existingIdx > -1 && detail) {
          newProgress[existingIdx].details = detail;
        }
      });
      setProgress(newProgress);
      setActiveTab('story');
      playWandSound();
    } catch (error: any) {
      console.error("Magic Error:", error);
      alert("魔法召唤失败: " + (error.message || "未知错误") + "\n请检查 API Key 是否有效或网络是否通畅。");
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setIsCameraOpen(false);
      alert("无法开启魔法相机，请检查权限。");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        stopCamera();
        processImage(base64);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    // Check if API key is set
    const hasKey = !!(import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.VITE_OPENROUTER_API_KEY || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY));
    
    if (!hasKey) {
      alert("魔法咒语失效了！\n\n请在 Vercel 环境变量中设置:\nVITE_GEMINI_API_KEY 或 VITE_OPENROUTER_API_KEY\n\n设置后记得重新部署(Redeploy)哦！");
      return;
    }

    setIsLoading(true);
    try {
      const recognizedWords = await recognizeWordsFromImage(base64);
      if (recognizedWords.length > 0) {
        setInputWords(recognizedWords.join(", "));
        handleStartMagic(recognizedWords);
      } else {
        alert("魔法猫头鹰没能看清图片中的单词，请换一张试试。");
      }
    } catch (error: any) {
      console.error("Recognition error:", error);
      alert("魔法识别失败: " + (error.message || "未知错误") + "\n请确保您的 API Key 有效。");
    } finally {
      setIsLoading(false);
    }
  };

  const repairWordMagic = async (word: string) => {
    setIsLoading(true);
    try {
      const data = await generateWizardContent([word]);
      const detail = data.wordDetails[0];
      if (detail) {
        const newProgress = progress.map(p => 
          p.word.toLowerCase() === word.toLowerCase() ? { ...p, details: detail } : p
        );
        setProgress(newProgress);
        setSelectedWord(detail);
        playWandSound();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStoryWithClickableWords = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const word = part.slice(2, -2);
        const detail = sessionData.wordDetails.find((d: any) => d.word.toLowerCase() === word.toLowerCase());
        return (
          <span 
            key={i} 
            onClick={() => {
              if (detail) {
                setSelectedWord(detail);
                playWandSound();
              }
            }}
            className="text-gryffindor-red underline font-bold cursor-pointer hover:text-gryffindor-gold transition-colors"
          >
            {word}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleQuizOptionClick = (questionIdx: number, option: string, correctAnswer: string) => {
    playWandSound();
    const isCorrect = option === correctAnswer;
    setQuizAnswers(prev => ({ ...prev, [questionIdx]: option }));
    setQuizFeedback(prev => ({ ...prev, [questionIdx]: isCorrect ? 'correct' : 'wrong' }));
    
    if (isCorrect) {
      setOwlStats(prev => ({
        ...prev,
        totalMagic: prev.totalMagic + 1
      }));
      setShowNotification("答对题目！魔力 +1");
      setTimeout(() => setShowNotification(null), 2000);
    }
  };

  const handleDictationSubmit = () => {
    const currentWord = sessionData.wordDetails[dictationIndex].word.toLowerCase();
    const isCorrect = dictationInput.toLowerCase().trim() === currentWord;
    
    setDictationResult(isCorrect ? 'correct' : 'wrong');
    playWandSound();
    
    if (isCorrect) {
      setOwlStats(prev => ({
        ...prev,
        totalMagic: prev.totalMagic + 2
      }));
      setShowNotification("拼写正确！魔力 +2");
      setTimeout(() => setShowNotification(null), 2000);
    }
    
    const newProgress = progress.map(p => {
      if (p.word.toLowerCase() === currentWord) {
        const newCorrectCount = isCorrect ? p.correctCount + 1 : 0;
        const newMagicValue = isCorrect ? Math.min(100, p.magicValue + 10) : Math.max(0, p.magicValue - 20);
        return {
          ...p,
          magicValue: newMagicValue,
          correctCount: newCorrectCount,
          lastReview: Date.now(),
          nextReview: calculateNextReview(newCorrectCount),
          isMastered: newCorrectCount >= 5
        };
      }
      return p;
    });
    
    setProgress(newProgress);

    setTimeout(() => {
      if (isCorrect) {
        if (dictationIndex < sessionData.wordDetails.length - 1) {
          setDictationIndex(prev => prev + 1);
          setDictationInput('');
          setDictationResult('idle');
        } else {
          setActiveTab('quiz');
        }
      } else {
        setDictationResult('idle');
      }
    }, 1500);
  };

  const feedOwl = () => {
    if (owlStats.totalMagic >= 10) {
      setOwlStats(prev => {
        const newExp = prev.experience + 20;
        const newLevel = Math.floor(newExp / 100) + 1;
        return {
          ...prev,
          totalMagic: prev.totalMagic - 10,
          experience: newExp,
          level: newLevel,
          hunger: Math.max(0, prev.hunger - 20)
        };
      });
      playWandSound();
      setShowNotification("海德薇吃得很开心！等级提升进度增加。");
      setTimeout(() => setShowNotification(null), 2000);
    } else {
      setShowNotification("魔力不足，快去学习赚取魔力吧！");
      setTimeout(() => setShowNotification(null), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 font-serif">
      {/* Word Detail Modal */}
      <AnimatePresence>
        {selectedWord && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedWord(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="wizard-card max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-4xl font-display text-gryffindor-red">{selectedWord.word}</h3>
                <button onClick={() => setSelectedWord(null)} className="text-2xl text-gray-400 hover:text-ink">&times;</button>
              </div>
              <p className="text-xl mb-4 font-bold border-b border-gryffindor-gold/30 pb-2">{selectedWord.meaning}</p>
              <div className="space-y-4">
                <div className="bg-white/40 p-3 rounded-sm border-l-4 border-gryffindor-gold">
                  <p className="text-xs font-display text-gryffindor-gold mb-1">基础级 / Basic</p>
                  <p>{selectedWord.sentenceA}</p>
                </div>
                <div className="bg-white/40 p-3 rounded-sm border-l-4 border-gryffindor-red">
                  <p className="text-xs font-display text-gryffindor-red mb-1">情景级 / Scenario</p>
                  <p>{selectedWord.sentenceB}</p>
                </div>
                <div className="bg-white/40 p-3 rounded-sm border-l-4 border-gryffindor-gold">
                  <p className="text-xs font-display text-gryffindor-gold mb-1">挑战级 / Challenge</p>
                  <p>{selectedWord.sentenceC}</p>
                </div>
              </div>
              <button onClick={() => setSelectedWord(null)} className="wizard-button w-full mt-6">关闭魔法书</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 z-50 w-full max-w-md"
          >
            <div className="bg-gryffindor-red text-gryffindor-gold p-4 rounded-lg shadow-2xl border-2 border-gryffindor-gold flex items-start gap-3">
              <Zap className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-display text-sm mb-1">咆哮信 / Howler</p>
                <p className="text-sm">{showNotification}</p>
                <button onClick={() => setShowNotification(null)} className="mt-2 text-xs underline">我知道了</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-12 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center justify-center gap-4 mb-4"
        >
          <Wand2 className="w-12 h-12 text-gryffindor-gold animate-float" />
          <h1 className="text-5xl font-display text-gryffindor-gold tracking-widest drop-shadow-lg">
            HOGWARTS WORD WIZARD
          </h1>
          <Wand2 className="w-12 h-12 text-gryffindor-gold animate-float" style={{ animationDelay: '0.5s' }} />
        </motion.div>
        <p className="text-gryffindor-gold/80 italic font-medium">
          "It is our choices, Harry, that show what we truly are, far more than our abilities."
        </p>
      </header>

      <main className="w-full max-w-4xl">
        {/* Navigation Tabs */}
        <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'input', label: '新咒语', icon: Plus },
            { id: 'story', label: '魔法故事', icon: Scroll, hidden: !sessionData },
            { id: 'library', label: '词库', icon: BookOpen },
            { id: 'dictation', label: '听写试炼', icon: Wand2, hidden: !sessionData },
            { id: 'quiz', label: 'O.W.Ls 考核', icon: GraduationCap, hidden: !sessionData },
            { id: 'owl', label: '海德薇', icon: Bird },
          ].filter(t => !t.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-display transition-all whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-parchment text-ink border-t-2 border-x-2 border-gryffindor-gold' 
                : 'text-gryffindor-gold/60 hover:text-gryffindor-gold'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'owl' && (
            <motion.div 
              key="owl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="wizard-card text-center relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-gryffindor-gold/20 px-3 py-1 rounded-full border border-gryffindor-gold">
                <Zap className="w-4 h-4 text-gryffindor-gold" />
                <span className="font-display text-sm">魔力: {owlStats.totalMagic}</span>
              </div>

              <div className="mb-8 relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="w-48 h-48 mx-auto bg-white/30 rounded-full flex items-center justify-center border-4 border-gryffindor-gold shadow-inner"
                >
                  <Bird className="w-32 h-32 text-gryffindor-gold drop-shadow-[0_0_15px_rgba(211,166,37,0.5)]" />
                </motion.div>
                <div className="mt-4">
                  <h2 className="text-4xl font-display text-gryffindor-red">{owlStats.name}</h2>
                  <p className="text-gryffindor-gold font-display">等级 {owlStats.level} 魔法猫头鹰</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/40 p-4 rounded-lg border border-gryffindor-gold/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-display flex items-center gap-1"><Sparkles className="w-3 h-3" /> 经验值</span>
                    <span className="text-xs">{owlStats.experience % 100} / 100</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${owlStats.experience % 100}%` }}
                      className="h-full bg-gryffindor-gold" 
                    />
                  </div>
                </div>
                <div className="bg-white/40 p-4 rounded-lg border border-gryffindor-gold/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-display flex items-center gap-1"><Heart className="w-3 h-3" /> 饥饿度</span>
                    <span className="text-xs">{owlStats.hunger} / 100</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${owlStats.hunger}%` }}
                      className="h-full bg-gryffindor-red" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={feedOwl}
                  className="wizard-button w-full flex items-center justify-center gap-3 py-4"
                >
                  <Cookie className="w-6 h-6" />
                  喂食 (消耗 10 魔力)
                </button>
                <p className="text-xs text-gray-500 italic">
                  “海德薇最喜欢吃猫头鹰粮了。每写对一个单词加 2 魔力，答对题目加 1 魔力。”
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'input' && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="wizard-card text-center"
            >
              <h2 className="text-3xl font-display mb-6">准备好你的羽毛笔，小巫师！</h2>
              
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={startCamera}
                  className="flex-1 wizard-button flex items-center justify-center gap-2 bg-gryffindor-gold/20 text-gryffindor-red border-gryffindor-red"
                >
                  <Camera className="w-6 h-6" />
                  魔法相机
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 wizard-button flex items-center justify-center gap-2 bg-gryffindor-gold/20 text-gryffindor-red border-gryffindor-red"
                >
                  <Upload className="w-6 h-6" />
                  上传图片
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <p className="mb-4 text-lg">或者手动输入咒语：</p>
              <textarea
                value={inputWords}
                onChange={(e) => setInputWords(e.target.value)}
                placeholder="例如: magic, wizard, castle, dragon..."
                className="w-full h-32 p-4 bg-white/50 border-2 border-gryffindor-gold/30 rounded-sm mb-6 focus:border-gryffindor-gold outline-none text-xl font-serif"
              />
              <button 
                onClick={() => handleStartMagic()}
                disabled={isLoading}
                className="wizard-button text-xl py-4 w-full flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <Sparkles className="animate-spin" />
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    开启魔法之旅
                  </>
                )}
              </button>

              {/* Camera Modal */}
              <AnimatePresence>
                {isCameraOpen && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4"
                  >
                    <div className="relative w-full max-w-2xl aspect-video bg-gray-900 rounded-lg overflow-hidden border-4 border-gryffindor-gold">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        onCanPlay={() => videoRef.current?.play()}
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 border-2 border-dashed border-white/30 pointer-events-none m-8" />
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="flex gap-8 mt-8">
                      <button 
                        onClick={stopCamera}
                        className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                      >
                        <X className="w-8 h-8" />
                      </button>
                      <button 
                        onClick={captureImage}
                        className="w-20 h-20 rounded-full bg-gryffindor-gold flex items-center justify-center text-gryffindor-red shadow-[0_0_20px_rgba(211,166,37,0.5)] hover:scale-110 transition-all"
                      >
                        <Camera className="w-10 h-10" />
                      </button>
                    </div>
                    <p className="text-gryffindor-gold mt-4 font-display">对准书本上的单词，让猫头鹰识别</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'story' && sessionData && (
            <motion.div 
              key="story"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="wizard-card"
            >
              <h2 className="text-4xl font-display text-center mb-8 border-b-2 border-gryffindor-gold pb-4">
                {sessionData.story.title}
              </h2>
              <div className="grid md:grid-cols-2 gap-8 text-lg leading-relaxed">
                <div className="space-y-4">
                  <h3 className="font-display text-gryffindor-red border-l-4 border-gryffindor-red pl-2">English</h3>
                  <div>{renderStoryWithClickableWords(sessionData.story.contentEn)}</div>
                </div>
                <div className="space-y-4 bg-black/5 p-4 rounded-sm italic">
                  <h3 className="font-display text-gryffindor-red border-l-4 border-gryffindor-red pl-2">中文对照</h3>
                  <p>{sessionData.story.contentZh}</p>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button onClick={() => setActiveTab('library')} className="wizard-button flex items-center gap-2">
                  深度拆解词义 <ChevronRight />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-display text-gryffindor-gold">大魔法师词库</h2>
                <div className="flex gap-4 text-sm font-display">
                  <span className="text-green-600">已掌握: {progress.filter(p => p.isMastered).length}</span>
                  <span className="text-gryffindor-gold">总数: {progress.length}</span>
                </div>
              </div>

              {progress.length === 0 ? (
                <div className="wizard-card text-center py-12">
                  <p className="text-xl italic">你的词库空空如也，快去学习新咒语吧！</p>
                </div>
              ) : (
                progress.sort((a, b) => b.magicValue - a.magicValue).map((p, idx) => {
                  const detail = p.details || sessionData?.wordDetails?.find((d: any) => d.word.toLowerCase() === p.word.toLowerCase());
                  return (
                    <motion.div 
                      key={p.word}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="wizard-card group hover:shadow-2xl transition-all cursor-pointer"
                      onClick={() => {
                        playWandSound();
                        if (detail) {
                          setSelectedWord(detail);
                        } else {
                          // If detail is missing, offer to repair
                          repairWordMagic(p.word);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-3xl font-display text-gryffindor-red flex items-center gap-2">
                            {p.word}
                            {p.isMastered && <Sparkles className="w-5 h-5 text-gryffindor-gold" />}
                          </h3>
                          {detail ? (
                            <p className="text-xl mt-2">{detail.meaning}</p>
                          ) : (
                            <p className="text-sm italic text-gray-400 mt-2 flex items-center gap-2">
                              <Sparkles className="w-3 h-3 animate-pulse" />
                              正在注入魔法记忆...
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定要从魔法词库中抹除“${p.word}”吗？`)) {
                                setProgress(progress.filter(item => item.word !== p.word));
                              }
                            }}
                            className="p-1 text-gray-300 hover:text-gryffindor-red transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-gryffindor-gold" />
                            <span className="font-display text-sm">魔力值: {p.magicValue}%</span>
                          </div>
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gryffindor-gold transition-all duration-1000" 
                              style={{ width: `${p.magicValue}%` }}
                            />
                          </div>
                          <p className="text-[10px] mt-1 text-gray-400 uppercase">
                            下次复习: {new Date(p.nextReview).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              
              {sessionData && (
                <div className="flex justify-center pt-8">
                  <button onClick={() => setActiveTab('dictation')} className="wizard-button text-2xl py-4 px-12">
                    开始听写试炼
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'dictation' && sessionData && (
            <motion.div 
              key="dictation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="wizard-card max-w-2xl mx-auto text-center"
            >
              <div className="mb-8">
                <p className="font-display text-gryffindor-red mb-2">听写环节 / Dictation</p>
                <h2 className="text-2xl italic">“准备好你的羽毛笔，小巫师！听清楚这个咒语...”</h2>
              </div>

              <div className="mb-12">
                <button 
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(sessionData.wordDetails[dictationIndex].word);
                    utterance.lang = 'en-US';
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="w-24 h-24 rounded-full bg-gryffindor-gold/20 flex items-center justify-center mx-auto hover:bg-gryffindor-gold/40 transition-all group"
                >
                  <Volume2 className="w-12 h-12 text-gryffindor-gold group-hover:scale-110 transition-transform" />
                </button>
                <p className="mt-4 text-xl text-gray-600">{sessionData.wordDetails[dictationIndex].meaning}</p>
                <p className="text-sm italic text-gray-400">{sessionData.wordDetails[dictationIndex].ipa}</p>
              </div>

              <div className="relative mb-8">
                <input
                  type="text"
                  value={dictationInput}
                  onChange={(e) => setDictationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDictationSubmit()}
                  placeholder="在这里输入咒语..."
                  className={`w-full text-center text-4xl p-4 bg-transparent border-b-4 outline-none font-display transition-colors ${
                    dictationResult === 'correct' ? 'border-green-500 text-green-600' :
                    dictationResult === 'wrong' ? 'border-red-500 text-red-600' :
                    'border-gryffindor-gold text-ink'
                  }`}
                  autoFocus
                />
                <AnimatePresence>
                  {dictationResult === 'correct' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-12 top-4">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </motion.div>
                  )}
                  {dictationResult === 'wrong' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-12 top-4">
                      <XCircle className="w-10 h-10 text-red-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-between items-center text-sm font-display text-gray-500">
                <span>进度: {dictationIndex + 1} / {sessionData.wordDetails.length}</span>
                <button onClick={handleDictationSubmit} className="wizard-button">
                  施放咒语
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'quiz' && sessionData && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-display text-gryffindor-gold mb-4">O.W.Ls 魔法考核</h2>
                <p className="italic">“只有最专注的巫师才能通过这项考试。”</p>
              </div>

              {sessionData.quiz.map((q: any, idx: number) => (
                <div key={idx} className="wizard-card">
                  <p className="text-xl mb-6 font-bold">{idx + 1}. {q.question}</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {q.options.map((opt: string) => {
                      const isSelected = quizAnswers[idx] === opt;
                      const feedback = quizFeedback[idx];
                      let buttonClass = "p-4 text-left border-2 border-gryffindor-gold/20 rounded-sm hover:bg-gryffindor-gold/10 hover:border-gryffindor-gold transition-all";
                      
                      if (isSelected) {
                        if (feedback === 'correct') buttonClass = "p-4 text-left border-2 border-green-500 bg-green-50 text-green-700 rounded-sm";
                        else if (feedback === 'wrong') buttonClass = "p-4 text-left border-2 border-red-500 bg-red-50 text-red-700 rounded-sm";
                      } else if (feedback === 'wrong' && opt === q.answer) {
                        buttonClass = "p-4 text-left border-2 border-green-500 bg-green-50 text-green-700 rounded-sm";
                      }

                      return (
                        <button 
                          key={opt}
                          onClick={() => handleQuizOptionClick(idx, opt, q.answer)}
                          disabled={!!quizFeedback[idx]}
                          className={buttonClass}
                        >
                          <div className="flex justify-between items-center">
                            <span>{opt}</span>
                            {isSelected && feedback === 'correct' && <CheckCircle2 className="w-5 h-5" />}
                            {isSelected && feedback === 'wrong' && <XCircle className="w-5 h-5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex flex-col items-center gap-6 pt-8">
                <div className="wizard-card w-full max-w-lg text-center bg-gryffindor-red/5">
                  <h3 className="text-2xl font-display mb-4">艾宾浩斯复习计划</h3>
                  <div className="flex justify-between items-center gap-2">
                    {[1, 2, 4, 7, 15].map(day => (
                      <div key={day} className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-gryffindor-gold text-white flex items-center justify-center font-display text-xs mb-1">
                          {day}d
                        </div>
                        <span className="text-[10px] uppercase">复习</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setDictationIndex(0);
                    setDictationInput('');
                    setDictationResult('idle');
                    setActiveTab('input');
                  }}
                  className="wizard-button flex items-center gap-2 text-xl py-4 px-12"
                >
                  <RotateCcw /> 学习新咒语
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 text-gryffindor-gold/40 text-sm font-display tracking-widest">
        PROPERTY OF HOGWARTS SCHOOL OF WITCHCRAFT AND WIZARDRY
      </footer>
    </div>
  );
}
