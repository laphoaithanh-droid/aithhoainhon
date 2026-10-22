import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('✅ GoogleGenAI initialized successfully.');
  } catch (err) {
    console.warn('⚠️ GoogleGenAI initialization error:', err);
  }
} else {
  console.log('ℹ️ Running in demo pedagogical mode (No GEMINI_API_KEY provided).');
}

// Check AI status
app.get('/api/ai/status', (req: Request, res: Response) => {
  res.json({
    hasKey: Boolean(aiClient),
    model: 'gemini-3.8-flash',
    mode: aiClient ? 'live' : 'pedagogical_demo',
  });
});

function getAiClient(req: Request): GoogleGenAI | null {
  const clientKey = (req.body?.clientApiKey as string) || (req.headers['x-gemini-api-key'] as string);
  if (clientKey) {
    try {
      return new GoogleGenAI({
        apiKey: clientKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
    } catch (e) {
      console.warn('Custom client key init error:', e);
    }
  }
  return aiClient;
}

/**
 * 1. AI Buddy Chat for Grade 3 Students (Bilingual English - Vietnamese)
 */
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, history, subject, className, teacherName, clientModel, materialsContext } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const client = getAiClient(req);
  if (!client) {
    // Graceful pedagogical fallback handled by frontend or direct response
    return res.status(503).json({ error: 'AI key not configured; using offline pedagogy fallback' });
  }

  try {
    let systemInstruction = `Bạn là "AI Buddy" - Trợ lý học tập thông minh, thân thiện của học sinh lớp ${className || '3C1'}, Trường Tiểu học Hoài Nhơn, đồng hành cùng cô giáo chủ nhiệm ${teacherName || 'Đỗ Thị Hoà'}.
Đối tượng trò chuyện: Học sinh tiểu học 8-9 tuổi (Lớp 3).
Nguyên tắc sư phạm chuẩn mực:
1. Luôn dùng giọng điệu ấm áp, kiên nhẫn, khen ngợi, khuyến khích (ví dụ: "Chào bạn nhỏ!", "Bạn làm tốt lắm!", "Hãy cùng mình suy nghĩ nhé!").
2. Giải thích kiến thức ngắn gọn, trực quan, dễ hiểu, dùng ngôn ngữ trong sáng của học sinh tiểu học.
3. Hỗ trợ song ngữ Tiếng Anh và Tiếng Việt.
4. Với bài toán khó hoặc bài tập tư duy, TUYỆT ĐỐI KHÔNG đưa ngay đáp án cuối cùng! Chỉ đưa ra gợi ý từng bước (hint) giúp học sinh tự tìm ra đáp án.
5. Tuyệt đối an toàn cho trẻ em: không hỏi thông tin riêng tư, không tự nhận là con người và tôn trọng vai trò của cô giáo ${teacherName || 'Đỗ Thị Hoà'}.`;

    // Phân môn chuyên biệt sư phạm
    const sub = (subject || '').toLowerCase();
    if (sub.includes('anh') || sub.includes('english')) {
      systemInstruction += `\n\n[PHÂN MÔN: TIẾNG ANH (ENGLISH)]:
- Bạn là người bạn luyện Tiếng Anh (English Buddy) chuẩn phát âm phonics, từ vựng và đàm thoại.
- Sử dụng song ngữ Tiếng Anh và Tiếng Việt, câu tiếng Anh đi kèm nghĩa tiếng Việt trong ngoặc.
- Dạy từ vựng kèm phát âm mô phỏng vui nhộn và câu ví dụ song ngữ Anh - Việt.
- Khuyến khích học sinh đọc to, luyện nói phản xạ và khen ngợi bằng tiếng Anh: "Awesome!", "Good job!", "Well done!".
- Cung cấp đoạn hội thoại mini mẫu ngắn và đố vui ôn tập từ vựng.`;
    } else if (sub.includes('toán') || sub.includes('math')) {
      systemInstruction += `\n\n[PHÂN MÔN: TOÁN HỌC]:
- Tuân thủ phương pháp phát triển năng lực tư duy toán học GDPT 2018.
- KHÔNG cho ngay đáp án số cuối cùng!
- Hướng dẫn 4 bước: 1. Đọc kỹ đề bài (cho biết gì, hỏi gì); 2. Phân tích bước tính (bước 1 tính gì, bước 2 tính gì); 3. Gợi ý phép tính; 4. Nhắc kiểm tra lại kết quả.
- Sử dụng hình ảnh trực quan gần gũi: quả táo, que tính, đoạn thẳng, viên kẹo.`;
    } else if (sub.includes('việt') || sub.includes('văn')) {
      systemInstruction += `\n\n[PHÂN MÔN: TIẾNG VIỆT]:
- Giải nghĩa từ ngữ ngắn gọn, dễ hiểu; chỉ ra từ đồng nghĩa, từ trái nghĩa.
- Hướng dẫn các biện pháp tu từ trong chương trình lớp 3: So sánh (với từ so sánh "như", "là", "tựa"), Nhân hóa.
- Gợi ý cách đặt câu trọn ý, cách viết đoạn văn kể/tả giàu hình ảnh và cảm xúc chân thật.`;
    } else if (sub.includes('tin') || sub.includes('công nghệ') || sub.includes('it')) {
      systemInstruction += `\n\n[PHÂN MÔN: TIN HỌC & CÔNG NGHỆ]:
- Hướng dẫn tư thế ngồi gõ bàn phím 10 ngón đúng chuẩn, đặt 2 ngón trỏ vào 2 phím có gờ định vị F và J ở hàng phím cơ sở.
- Giải thích tư duy thuật toán, khối lệnh lập trình trực quan (Scratch/Blockly) đơn giản.
- Nhắc nhở quy tắc công dân số: bảo vệ mật khẩu, không bấm vào liên kết lạ, thời gian sử dụng màn hình hợp lý.`;
    } else if (sub.includes('khoa') || sub.includes('tự nhiên') || sub.includes('tnxh')) {
      systemInstruction += `\n\n[PHÂN MÔN: KHOA HỌC & TỰ NHIÊN - XÃ HỘI]:
- Giải thích các hiện tượng thiên nhiên, sự sống của động thực vật, các bộ phận cơ thể người bằng lăng kính khoa học kỳ thú.
- Giáo dục bảo vệ môi trường, phân loại rác, ăn chín uống sôi và giữ gìn vệ sinh thân thể.`;
    } else if (sub.includes('lịch') || sub.includes('địa')) {
      systemInstruction += `\n\n[PHÂN MÔN: LỊCH SỬ VÀ ĐỊA LÍ]:
- Kể chuyện truyền cảm hứng về các vị anh hùng dân tộc, di tích lịch sử và danh lam thắng cảnh Việt Nam.
- Kết nối tự hào với địa phương Hoài Nhơn, Bình Định và tình yêu quê hương đất nước.`;
    }

    if (materialsContext) {
      systemInstruction += `\n\n[DỮ LIỆU KHO HỌC LIỆU SỐ TRƯỜNG TIỂU HỌC HOÀI NHƠN ĐƯỢC LIÊN KẾT CHO MÔN NÀY]:\n${materialsContext}\nHãy ưu tiên vận dụng nội dung, khái niệm, ví dụ hoặc câu hỏi từ kho học liệu số này để giải thích, gợi ý hoặc đố vui cho học sinh.`;
    }

    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: `[Môn học: ${subject || 'Chung'}] ${message}` }],
    });

    const response = await client.models.generateContent({
      model: clientModel || 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'Bạn nhỏ ơi, hãy cùng suy nghĩ thêm một chút nhé!';
    return res.json({ reply });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    return res.status(500).json({ error: error.message || 'Lỗi xử lý AI' });
  }
});

/**
 * 2. Teacher AI Assistant for Cô Đỗ Thị Hoà
 */
app.post('/api/gemini/assistant', async (req: Request, res: Response) => {
  const { taskType, parameters, teacherName, className, school, clientModel } = req.body;

  if (!taskType) {
    return res.status(400).json({ error: 'taskType is required' });
  }

  const client = getAiClient(req);
  if (!client) {
    return res.status(503).json({ error: 'AI key not configured' });
  }

  try {
    const effectiveTeacher = teacherName || 'Đỗ Thị Hoà';
    const effectiveClass = className || '3C1';
    const effectiveSchool = school || 'Trường Tiểu học Hoài Nhơn';
    const effectiveGrade = parameters?.grade || 3;
    const effectiveSubject = parameters?.subject || 'Tiếng Việt';
    const customReq = parameters?.customRequirements || '';

    const systemInstruction = `Bạn là Chuyên gia Nghiệp vụ Sư phạm Tiểu học AI cấp cao, hỗ trợ cô giáo ${effectiveTeacher}, GVCN lớp ${effectiveClass}, ${effectiveSchool}.
Bạn am hiểu sâu sắc:
1. Chương trình Giáo dục Phổ thông 2018 (GDPT 2018) của Bộ Giáo dục và Đào tạo Việt Nam.
2. Quy định xây dựng Kế hoạch bài dạy theo CÔNG VĂN 2345/BGDĐT-GDTH: Bám sát bài học, môn học, phân hóa đối tượng, tiến trình 4 hoạt động rõ nét.
3. Quy định đánh giá và xây dựng đề kiểm tra theo THÔNG TƯ 27/2020/TT-BGDĐT: Ma trận 3 mức độ (Mức 1: 40%, Mức 2: 30%, Mức 3: 30%), cấu trúc trắc nghiệm + tự luận, barem điểm và đáp án chi tiết.
Yêu cầu: Văn phong sư phạm chuẩn mực, định dạng Markdown rõ ràng, chuyên nghiệp, chính xác tuyệt đối theo môn học và yêu cầu của giáo viên.`;

    let prompt = '';

    // A. SOẠN GIÁO ÁN CHUẨN CÔNG VĂN 2345/BGDĐT-GDTH
    if (taskType === 'lesson_plan_2345' || taskType === 'lesson_plan') {
      prompt = `Hãy soạn một Kế hoạch bài dạy (Giáo án) CHUẨN CÔNG VĂN 2345/BGDĐT-GDTH bám sát theo thông tin sau:
- Trường: ${effectiveSchool} • Lớp: ${effectiveClass} (Khối ${effectiveGrade})
- Giáo viên thực hiện: ${effectiveTeacher}
- Môn học: ${effectiveSubject}
- Bộ sách giáo khoa: ${parameters?.bookSeries || 'Bộ sách Kết nối tri thức với cuộc sống'}
- Tên bài dạy: ${parameters?.lessonTitle || parameters?.topic || 'Bài học theo chương trình'}
- Thời lượng: ${parameters?.duration || '1 tiết (35 phút)'}
${customReq ? `- Yêu cầu / Ghi chú riêng của giáo viên: ${customReq}` : ''}

CẤU TRÚC BẮT BUỘC THEO CÔNG VĂN 2345/BGDĐT-GDTH:
I. YÊU CẦU CẦN ĐẠT:
   1. Năng lực đặc thù của môn ${effectiveSubject}: Nêu cụ thể 2-3 chỉ báo năng lực mà học sinh đạt được sau bài này.
   2. Năng lực chung: Tự chủ và tự học; Giao tiếp và hợp tác; Giải quyết vấn đề và sáng tạo (gắn liền với hoạt động trong tiết học).
   3. Phẩm chất chủ yếu: Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm (thể hiện qua hành vi cụ thể).
II. ĐỒ DÙNG DẠY HỌC:
   - Giáo viên: Thiết bị dạy học số, máy chiếu/Tivi tương tác, ứng dụng AI Class/AI Buddy, phiếu học tập.
   - Học sinh: SGK, vở ghi, bảng con, thiết bị học tập thông minh (nếu có).
III. CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU (Tiến trình 4 bước):
   1. Hoạt động Khởi động (kết nối kiến thức, tạo tâm thế hứng thú)
   2. Hoạt động Khám phá (hình thành kiến thức mới)
   3. Hoạt động Luyện tập, thực hành (có phân hóa đối tượng học sinh: Cần hỗ trợ, Hoàn thành, Năng khiếu)
   4. Hoạt động Vận dụng, trải nghiệm (gắn với thực tế đời sống, rèn luyện kỹ năng số)
IV. ĐIỀU CHỈNH SAU BÀI DẠY (nếu có)`;
    }

    // B. THIẾT KẾ ĐỀ KIỂM TRA ĐỊNH KỲ THEO THÔNG TƯ 27/2020/TT-BGDĐT
    else if (taskType === 'quiz_generator_tt27' || taskType === 'quiz_generator') {
      prompt = `Hãy thiết kế một Đề kiểm tra định kỳ môn ${effectiveSubject} CHUẨN THÔNG TƯ 27/2020/TT-BGDĐT theo đúng yêu cầu sau:
- Trường: ${effectiveSchool} • Lớp: ${effectiveClass} (Khối ${effectiveGrade})
- Giáo viên ra đề: ${effectiveTeacher}
- Môn kiểm tra: ${effectiveSubject}
- Thời gian làm bài: ${parameters?.duration || '35 phút'}
- Phạm vi kiến thức: ${parameters?.topic || 'Kiến thức trọng tâm theo chương trình'}
${customReq ? `- Yêu cầu / ghi chú riêng của giáo viên: ${customReq}` : ''}

CẤU TRÚC BẮT BUỘC THEO THÔNG TƯ 27/2020/TT-BGDĐT:
PHẦN A. BẢNG MA TRẬN ĐỀ KIỂM TRA THEO 3 MỨC ĐỘ:
   - Mức 1 (Nhận biết): 40% (4.0 điểm)
   - Mức 2 (Kết nối, hiểu): 30% (3.0 điểm)
   - Mức 3 (Vận dụng, sáng tạo): 30% (3.0 điểm)
   (Trình bày dạng bảng kẻ rõ ràng: Mạch kiến thức, Mức 1, Mức 2, Mức 3, Tổng số câu, Tổng số điểm)

PHẦN B. NỘI DUNG ĐỀ KIỂM TRA MÔN ${effectiveSubject.toUpperCase()}:
   - Phần I: TRẮC NGHIỆM KHÁCH QUAN (4-6 câu trắc nghiệm nhiều lựa chọn A, B, C, D hoặc nối cột, đúng/sai).
   - Phần II: TỰ LUẬN & VẬN DỤNG THỰC TẾ (2-3 câu tự luận, yêu cầu trình bày bài giải hoặc viết câu/đoạn văn).
   - Ghi rõ mức độ (Mức 1, Mức 2, Mức 3) và điểm số cạnh mỗi câu hỏi.

PHẦN C. ĐÁP ÁN VÀ THANG ĐIỂM (BAREM ĐIỂM) CHI TIẾT:
   - Đáp án trắc nghiệm chi tiết.
   - Hướng dẫn chấm từng bước cho phần tự luận với thang điểm tổng cộng là 10.0 điểm.`;
    }

    // C. NHẬN XÉT ĐÁNH GIÁ ĐỊNH KỲ THÔNG TƯ 27
    else if (taskType === 'tt27_comment' || taskType === 'differentiated_comment') {
      prompt = `Hãy soạn Lời nhận xét đánh giá học sinh tiểu học CHUẨN THÔNG TƯ 27/2020/TT-BGDĐT cho đợt: ${parameters?.period || 'Giữa Học kỳ'}.
- Học sinh: ${JSON.stringify(parameters?.studentData || {})}
- Lớp: ${effectiveClass} • GVCN: ${effectiveTeacher}
Lời nhận xét cần đầy đủ 4 phần:
1. Đánh giá Môn học & Hoạt động giáo dục (chỉ rõ điểm nổi bật về kiến thức, kỹ năng môn học).
2. Đánh giá Năng lực chung (Tự chủ tự học, Giao tiếp hợp tác, Giải quyết vấn đề sáng tạo).
3. Đánh giá Phẩm chất (Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm).
4. Biện pháp hỗ trợ cụ thể & Lời khuyên phối hợp cùng phụ huynh học sinh.`;
    }

    // D. LỘ TRÌNH PHỤ ĐẠO CÁ NHÂN HÓA (REMEDIATION)
    else if (taskType === 'personalized_remediation') {
      prompt = `Hãy lập Kế hoạch Bồi dưỡng & Phụ đạo cá nhân hóa trong 2 tuần cho học sinh: ${JSON.stringify(parameters?.studentData || {})}, lớp ${effectiveClass}, GVCN ${effectiveTeacher}.
Nêu rõ mục tiêu, lộ trình phối hợp 3 bên (Giáo viên tại lớp, Học sinh tự học với AI Buddy, Phụ huynh hỗ trợ tại nhà) và tiêu chí khen thưởng sau 2 tuần.`;
    }

    // E. RUBRIC NĂNG LỰC SỐ
    else if (taskType === 'digital_skills_rubric') {
      prompt = `Hãy thiết kế Khung Rubric đánh giá Năng lực số và Kỹ năng thế kỷ 21 cho học sinh tiểu học lớp ${effectiveClass} (${effectiveSchool}) theo 4 tiêu chí và 3 mức độ (Tốt, Đạt, Cần cố gắng).`;
    }

    // F. THƯ THÔNG BÁO GỬI PHỤ HUYNH
    else if (taskType === 'announcement') {
      prompt = `Hãy soạn một bức thư/thông báo gửi Quý phụ huynh học sinh lớp ${effectiveClass} (${effectiveSchool}) về chủ đề: "${parameters?.topic || 'Kế hoạch học tập tuần mới và rèn luyện kỹ năng số'}". Ký tên: Giáo viên chủ nhiệm ${effectiveTeacher}. Văn phong trân trọng, gắn kết yêu thương, rõ ràng.`;
    }

    // G. NỘI QUY LỚP HỌC HẠNH PHÚC
    else if (taskType === 'positive_rules') {
      prompt = `Hãy sáng tác 5-7 câu thơ hoặc vè 4-5 chữ vui tươi, dễ nhớ làm Nội quy lớp học hạnh phúc cho học sinh lớp ${effectiveClass} (${effectiveSchool}). GVCN: ${effectiveTeacher}.`;
    }

    else {
      prompt = `Hỗ trợ giáo viên lớp ${effectiveClass}: ${JSON.stringify(parameters)}`;
    }

    const response = await client.models.generateContent({
      model: clientModel || 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.json({ content: response.text || '' });
  } catch (error: any) {
    console.error('Teacher assistant error:', error);
    return res.status(500).json({ error: error.message || 'Lỗi xử lý trợ lý giáo viên' });
  }
});

/**
 * 3. Smart Game Generator: Auto-parse uploaded question files & answer keys
 */
app.post('/api/gemini/parse-game', async (req: Request, res: Response) => {
  const { content, answerKeyText, clientModel } = req.body;

  const client = getAiClient(req);
  if (!client) {
    return res.status(503).json({ error: 'AI key not configured' });
  }

  try {
    const prompt = `Bạn là hệ thống bóc tách học liệu trò chơi sư phạm tiểu học.
Nội dung file/văn bản tải lên:
"""
${content}
"""

Nội dung file đáp án (nếu có):
"""
${answerKeyText || 'Không có file đáp án riêng, hãy tự tìm đáp án chuẩn.'}
"""

Hãy bóc tách thành danh sách câu hỏi trắc nghiệm/ghép từ cho học sinh lớp 3. Trả về đúng định dạng JSON:
{
  "suggestedGameType": "magic-quiz" | "word-match" | "picture-detective" | "educational-bingo",
  "questions": [
    {
      "id": "gen-1",
      "prompt": "Nội dung câu hỏi",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "answer": "Đáp án đúng",
      "hint": "Gợi ý nhẹ nhàng"
    }
  ]
}`;

    const response = await client.models.generateContent({
      model: clientModel || 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Parse game error:', error);
    return res.status(500).json({ error: 'Không thể bóc tách trò chơi từ dữ liệu tải lên' });
  }
});

/**
 * 4. Online Classroom Database API (Persistent Cloud / Server DB Engine)
 */
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'classroom_db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadServerDb(): any {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      classId: 'c-3c1',
      activeClassId: 'c-3c1',
      className: 'Lớp 3C1 - Trường Tiểu học Hoài Nhơn',
      revision: 1,
      lastUpdated: new Date().toISOString(),
      classes: [],
      students: [],
      assignments: [],
      notifications: [],
      feedbacks: [],
      materials: [],
      subjects: [],
      genericLessons: [],
      games: [],
      teacherPasswords: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (!parsed.revision) parsed.revision = 1;
      return parsed;
    }
    return { revision: 1, lastUpdated: new Date().toISOString(), students: [], assignments: [], notifications: [], feedbacks: [], materials: [] };
  } catch (err) {
    console.error('Lỗi đọc database file:', err);
    return { revision: 1, lastUpdated: new Date().toISOString(), students: [], assignments: [], notifications: [], feedbacks: [], materials: [] };
  }
}

function saveServerDb(data: any) {
  ensureDataDir();
  data.revision = (Number(data.revision) || 0) + 1;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

// Kết nối & Tải danh sách lớp từ Google Sheets
app.post('/api/db/google-sheets/fetch', async (req: Request, res: Response) => {
  try {
    const { sheetUrl, apiKey, range } = req.body;
    if (!sheetUrl) {
      return res.status(400).json({ success: false, error: 'Thiếu đường link Google Sheet' });
    }

    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
    const sheetId = sheetIdMatch ? sheetIdMatch[1] : null;
    const gid = gidMatch ? gidMatch[1] : '0';

    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: 'Đường dẫn Google Sheet không đúng định dạng. Hãy copy link đầy đủ dạng https://docs.google.com/spreadsheets/d/.../edit'
      });
    }

    // 1. Nếu có Google Sheets API key
    if (apiKey) {
      const targetRange = encodeURIComponent(range || 'Sheet1!A1:Z100');
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${targetRange}?key=${apiKey}`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        const data = await apiRes.json();
        return res.json({ success: true, type: 'api', values: data.values || [] });
      }
    }

    // 2. Tải qua Google Visualization Export (Dành cho trang tính chia sẻ công khai)
    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${gid}`
    ];

    let csvText = '';
    for (const url of csvUrls) {
      try {
        const csvRes = await fetch(url, { headers: { 'Accept': 'text/csv,text/plain,*/*' } });
        if (csvRes.ok) {
          const text = await csvRes.text();
          if (text && !text.includes('<!DOCTYPE html>') && !text.includes('accounts.google.com')) {
            csvText = text;
            break;
          }
        }
      } catch (err) {
        // thử link tiếp theo
      }
    }

    if (!csvText) {
      return res.status(400).json({
        success: false,
        error: 'Không thể đọc dữ liệu từ Google Sheet. Hãy đảm bảo bạn đã bật Chia sẻ: "Bất kỳ ai có đường liên kết đều có thể xem" (Anyone with the link can view).'
      });
    }

    return res.json({
      success: true,
      type: 'csv',
      sheetId,
      gid,
      csvText
    });
  } catch (error: any) {
    console.error('Lỗi tải Google Sheet:', error);
    return res.status(500).json({ success: false, error: error.message || 'Lỗi kết nối máy chủ Google Sheets' });
  }
});

// Kiểm tra trạng thái CSDL Đám mây
app.get('/api/db/status', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    res.json({
      online: true,
      status: 'connected',
      type: 'express-cloud-db',
      message: `Máy chủ CSDL Đám mây Trường Tiểu học Hoài Nhơn đang hoạt động`,
      revision: Number(db.revision) || 1,
      lastUpdated: db.lastUpdated || new Date().toISOString(),
      recordCounts: {
        students: db.students?.length || 0,
        classes: db.classes?.length || 0,
        assignments: db.assignments?.length || 0,
        notifications: db.notifications?.length || 0,
        feedbacks: db.feedbacks?.length || 0,
        materials: db.materials?.length || 0,
        subjects: db.subjects?.length || 0,
        games: db.games?.length || 0,
      }
    });
  } catch (err: any) {
    res.status(500).json({ online: false, status: 'error', message: err.message });
  }
});

// Endpoint kiểm tra phiên bản nhẹ (Lightweight Version Check) phục vụ tự động đồng bộ giữa các máy
app.get('/api/db/version', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    res.json({
      success: true,
      revision: Number(db.revision) || 1,
      lastUpdated: db.lastUpdated || new Date().toISOString(),
      classId: db.activeClassId || db.classId || 'c-3c1',
      recordCounts: {
        students: db.students?.length || 0,
        classes: db.classes?.length || 0,
        assignments: db.assignments?.length || 0,
        notifications: db.notifications?.length || 0,
        feedbacks: db.feedbacks?.length || 0,
        materials: db.materials?.length || 0,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy toàn bộ dữ liệu CSDL Đám mây mới nhất (Cloud DB Latest)
app.get(['/api/db/latest', '/api/db/all'], (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    res.json({
      success: true,
      payload: db,
      revision: Number(db.revision) || 1,
      lastUpdated: db.lastUpdated || new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Đồng bộ đẩy dữ liệu lên CSDL Đám mây (Cloud Sync / Push)
app.post('/api/db/sync', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu payload' });
    }
    const currentDb = loadServerDb();
    const updatedDb = {
      ...currentDb,
      ...payload,
      classId: payload.classId || payload.activeClassId || currentDb.classId || 'c-3c1',
      activeClassId: payload.activeClassId || currentDb.activeClassId || 'c-3c1',
      classes: payload.classes || currentDb.classes || [],
      students: payload.students || currentDb.students || [],
      assignments: payload.assignments || currentDb.assignments || [],
      notifications: payload.notifications || currentDb.notifications || [],
      feedbacks: payload.feedbacks || currentDb.feedbacks || [],
      materials: payload.materials || currentDb.materials || [],
      subjects: payload.subjects || currentDb.subjects || [],
      genericLessons: payload.genericLessons || currentDb.genericLessons || [],
      games: payload.games || currentDb.games || [],
      teacherProfile: payload.teacherProfile || currentDb.teacherProfile,
      teacherPasswords: payload.teacherPasswords || currentDb.teacherPasswords || {},
      revision: (Number(currentDb.revision) || 0) + 1,
      lastUpdated: new Date().toISOString()
    };
    saveServerDb(updatedDb);
    res.json({
      success: true,
      message: 'Đồng bộ cơ sở dữ liệu đám mây thành công!',
      revision: updatedDb.revision,
      lastUpdated: updatedDb.lastUpdated,
      recordCounts: {
        students: updatedDb.students?.length || 0,
        classes: updatedDb.classes?.length || 0,
        assignments: updatedDb.assignments?.length || 0,
        notifications: updatedDb.notifications?.length || 0,
        feedbacks: updatedDb.feedbacks?.length || 0,
        materials: updatedDb.materials?.length || 0,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CRUD Students
app.get('/api/db/students', (req: Request, res: Response) => {
  const db = loadServerDb();
  res.json(db.students || []);
});

app.post('/api/db/students', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    const newStudent = req.body;
    if (!newStudent || !newStudent.id) {
      return res.status(400).json({ error: 'Dữ liệu học sinh không hợp lệ' });
    }
    const existingIndex = (db.students || []).findIndex((s: any) => s.id === newStudent.id);
    if (existingIndex >= 0) {
      db.students[existingIndex] = { ...db.students[existingIndex], ...newStudent };
    } else {
      db.students = [...(db.students || []), newStudent];
    }
    saveServerDb(db);
    res.json({ success: true, student: newStudent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/db/students/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = loadServerDb();
    db.students = (db.students || []).filter((s: any) => s.id !== id);
    saveServerDb(db);
    res.json({ success: true, message: `Đã xóa học sinh ${id}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD Assignments
app.get('/api/db/assignments', (req: Request, res: Response) => {
  const db = loadServerDb();
  res.json(db.assignments || []);
});

app.post('/api/db/assignments', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    const assignment = req.body;
    db.assignments = [assignment, ...(db.assignments || [])];
    saveServerDb(db);
    res.json({ success: true, assignment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD Notifications
app.get('/api/db/notifications', (req: Request, res: Response) => {
  const db = loadServerDb();
  res.json(db.notifications || []);
});

app.post('/api/db/notifications', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    const notification = req.body;
    db.notifications = [notification, ...(db.notifications || [])];
    saveServerDb(db);
    res.json({ success: true, notification });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD Feedbacks
app.get('/api/db/feedbacks', (req: Request, res: Response) => {
  const db = loadServerDb();
  res.json(db.feedbacks || []);
});

app.post('/api/db/feedbacks', (req: Request, res: Response) => {
  try {
    const db = loadServerDb();
    const feedback = req.body;
    db.feedbacks = [feedback, ...(db.feedbacks || [])];
    saveServerDb(db);
    res.json({ success: true, feedback });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`🚀 AI CLASS Server running on http://localhost:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = Number(port) + 1;
      console.warn(`⚠️ Cổng ${port} đang bận, tự động chuyển sang cổng ${fallbackPort}...`);
      app.listen(fallbackPort, '0.0.0.0', () => {
        console.log(`🚀 AI CLASS Server running on http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer();
