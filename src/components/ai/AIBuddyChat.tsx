import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Volume2,
  RotateCcw,
  ShieldCheck,
  Languages,
  Calculator,
  BookOpen,
  Laptop,
  CheckCircle2,
  FolderOpen,
  Layers
} from 'lucide-react';
import { geminiService, ChatMessage } from '../../services/geminiService';
import { speechService } from '../../services/speechService';
import { useApp } from '../../context/AppContext';

export const AIBuddyChat: React.FC = () => {
  const {
    currentUser,
    activeClass,
    teacherProfile,
    materials,
    subjects,
    aiLiveStatus,
    triggerCelebration
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Xin chào bạn nhỏ lớp ${activeClass.name}! 👋 Mình là AI Buddy - Người bạn đồng hành thông minh của cô giáo ${teacherProfile.name} (Trường Tiểu học Hoài Nhơn) đây! Hôm nay bạn muốn cùng mình học Tiếng Anh, giải đố Toán học, đọc Tiếng Việt hay tìm hiểu học liệu số nào trong thư viện? ⭐`,
      timestamp: 'Vừa xong',
      options: [
        'Học từ vựng Tiếng Anh chủ đề Friends',
        'Gợi ý cách giải bài toán 2 bước tính',
        'Tìm biện pháp so sánh trong câu thơ',
        'Vị trí hai phím xuất phát chuẩn F và J'
      ]
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Chung');
  const [isLoading, setIsLoading] = useState(false);

  const subjectQuickPrompts: Record<string, string[]> = {
    'Chung': [
      'Học từ vựng Tiếng Anh chủ đề Friends',
      'Gợi ý cách giải bài toán 2 bước tính',
      'Tìm biện pháp so sánh trong câu thơ',
      'Vị trí hai phím xuất phát chuẩn F và J'
    ],
    'Tiếng Anh': [
      'Luyện phát âm từ vựng chủ đề Family',
      'Mẫu câu hỏi thăm sức khỏe và bạn bè',
      'Đoạn hội thoại tiếng Anh ngắn tại lớp học',
      'Đố vui từ vựng về trường lớp'
    ],
    'Toán học': [
      'Gợi ý cách giải bài toán 2 bước tính',
      'Quy tắc tính giá trị biểu thức có nhân chia',
      'Bảng nhân 7 và bài toán chia có dư',
      'Bài toán đố vui tư duy hình học'
    ],
    'Tiếng Việt': [
      'Tìm hình ảnh so sánh trong câu thơ',
      'Biện pháp nhân hóa và ví dụ minh họa',
      'Gợi ý viết đoạn văn ngắn kể về người thân',
      'Giải nghĩa từ láy và từ ngữ chỉ cảm xúc'
    ],
    'Tin học': [
      'Vị trí đặt 10 ngón tay trên hàng phím cơ sở',
      'Tại sao hai phím F và J lại có gờ nổi?',
      '3 quy tắc an toàn bảo mật khi lên mạng',
      'Cách cầm chuột và tư thế ngồi chuẩn'
    ],
    'Khoa học': [
      'Các bộ phận của cây xanh và chức năng rễ',
      'Quá trình quang hợp của lá cây',
      'Làm thế nào để bảo vệ nguồn nước sạch?',
      'Cơ quan tuần hoàn trong cơ thể gồm những gì?'
    ],
    'Lịch sử & Địa lí': [
      'Kể chuyện về anh hùng dân tộc Việt Nam',
      'Giới thiệu cảnh đẹp quê hương Hoài Nhơn',
      'Đặc điểm khí hậu và sông ngòi nước ta',
      'Ý nghĩa của ngày Quốc khánh 2 tháng 9'
    ]
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Find linked materials for current subject
  const linkedMaterials = useMemo(() => {
    if (selectedSubject === 'Chung') return materials.slice(0, 4);
    return materials.filter(m => {
      const sub = subjects.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase());
      if (sub) {
        return m.subject.toLowerCase() === sub.id.toLowerCase() || m.subject.toLowerCase() === selectedSubject.toLowerCase();
      }
      return m.subject.toLowerCase().includes(selectedSubject.toLowerCase());
    });
  }, [materials, selectedSubject, subjects]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    // Call backend Gemini API via proxy service
    const history = messages.slice(-4).map(m => ({
      role: m.sender === 'user' ? ('user' as const) : ('model' as const),
      text: m.text
    }));

    // Generate materials context from linked materials
    const materialsContext = linkedMaterials
      .map(
        m =>
          `[Tài liệu: ${m.title} - Môn: ${m.subject}]\n${
            m.content || m.description
          }\n${m.keyConcepts ? 'Từ khóa: ' + m.keyConcepts.join(', ') : ''}`
      )
      .join('\n\n');

    const result = await geminiService.sendBuddyMessage(
      text,
      history,
      selectedSubject,
      materialsContext,
      teacherProfile.name,
      activeClass.name
    );

    setIsLoading(false);

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: result.text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      audioText: result.audioText
    };

    setMessages(prev => [...prev, aiMsg]);
    triggerCelebration();
  };

  const handleSpeakText = (text: string) => {
    const isEnglishSubject = selectedSubject.toLowerCase().includes('anh') || selectedSubject.toLowerCase() === 'english';
    speechService.speak(text, isEnglishSubject ? 'en-US' : 'vi-VN');
  };

  const handleSelectMaterialToAsk = (matTitle: string) => {
    handleSendMessage(`Chào AI Buddy, hãy hướng dẫn em học bài "${matTitle}" trong Kho học liệu số với!`);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-700/50 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-bold border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CHATBOT AI BUDDY – TRỢ LÝ HỌC TẬP THÂN THIỆN</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Người Bạn Đồng Hành Song Ngữ Của Lớp {activeClass.name}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl">
              Trường Tiểu học Hoài Nhơn • Đồng hành cùng cô {teacherProfile.name}. Kết nối trực tiếp với Kho học liệu số để giải thích bài học, hướng dẫn giải toán và đố vui ôn tập.
            </p>
          </div>

          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 p-1 flex items-center justify-center shrink-0 shadow-lg z-10">
            <div className="w-full h-full rounded-full bg-[#0B1428] flex items-center justify-center">
              <Bot className="w-8 h-8 text-emerald-300 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
          </div>
        </div>

        {/* Safe AI rules guarantee */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-[11px] text-emerald-200 z-10">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bảo vệ quyền riêng tư học sinh</span>
          </span>
          <span>•</span>
          <span>Đồng hành cùng cô giáo {teacherProfile.name}</span>
          <span>•</span>
          <span>Kết nối {materials.length} học liệu số</span>
          <span>•</span>
          <span className="text-amber-300">
            {aiLiveStatus.hasKey ? 'Gemini 3.8 Flash' : 'Chế độ sư phạm tương tác'}
          </span>
        </div>
      </div>

      {/* Main Chatbox Frame */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md flex flex-col h-[620px] overflow-hidden">
        {/* Chat Subject Switcher Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 shrink-0">Môn học:</span>
            {['Chung', 'Tiếng Anh', 'Toán học', 'Tiếng Việt', 'Tin học', 'Khoa học', 'Lịch sử & Địa lí'].map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  selectedSubject === sub
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setMessages([
                {
                  id: `rst-${Date.now()}`,
                  sender: 'ai',
                  text: `Mình đã sẵn sàng cho một cuộc trò chuyện mới cùng bạn nhỏ lớp ${activeClass.name}! Hãy chọn chủ đề hoặc đặt câu hỏi nhé! 🌟`,
                  timestamp: 'Vừa xong'
                }
              ]);
            }}
            className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
            title="Xóa làm mới đoạn hội thoại"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Linked Learning Materials Strip */}
        {linkedMaterials.length > 0 && (
          <div className="px-4 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="font-bold text-purple-900 flex items-center gap-1 shrink-0">
              <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Học liệu liên kết:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {linkedMaterials.slice(0, 3).map(mat => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => handleSelectMaterialToAsk(mat.title)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:border-purple-400 text-purple-800 font-medium whitespace-nowrap transition-colors flex items-center gap-1"
                  title="Nhấn để nhờ AI Buddy giải thích bài này"
                >
                  <BookOpen className="w-3 h-3 text-purple-600" />
                  <span className="truncate max-w-[200px]">{mat.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[80%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/80'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  <div className="flex items-center justify-between pt-1 mt-1 border-t border-current/10 text-[10px] opacity-75">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'ai' && (
                      <button
                        onClick={() => handleSpeakText(msg.text)}
                        className="hover:scale-110 transition-transform p-0.5 ml-2"
                        title="Nghe giọng đọc"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick suggestion bubbles if any */}
                {msg.options && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(opt)}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-colors text-left"
                      >
                        💡 {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-300 shrink-0"
                />
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 text-xs text-slate-500 italic flex items-center gap-2">
                <span>AI Buddy đang tra cứu học liệu và suy nghĩ lời giải thích...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick subject suggestion prompts */}
        {subjectQuickPrompts[selectedSubject] && (
          <div className="px-3 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-[10px] font-bold text-emerald-800 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Gợi ý môn {selectedSubject}:</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {subjectQuickPrompts[selectedSubject].map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors shrink-0 truncate max-w-[240px]"
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={`Hỏi AI Buddy về môn ${selectedSubject} hoặc các bài học trong Kho học liệu số...`}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
