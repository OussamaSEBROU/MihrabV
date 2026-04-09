import { Device } from '@capacitor/device';

// رابط الـ Backend الصحيح كما في موقع Render
const API_BASE_URL = 'https://mihrab-backend.onrender.com/api'; 

export const syncBridge = {
    // وظيفة جلب بصمة الجهاز بأمان (تعديل Safe-Mode)
    getDeviceId: async () => {
        try {
            // نحاول جلب البصمة الحقيقية من الهاتف
            const info = await Device.getId();
            return info.identifier;
        } catch (e) {
            // في حالة فشل الاتصال بالمكتبة (لتجنب الشاشة السوداء)
            // نقوم بصنع بصمة مؤقتة تعتمد على الوقت
            return 'Safe_Node_' + Date.now();
        }
    },

    /**
     * المزامنة الشاملة (النسخة المنقذة v2.4):
     * تقوم بإرسال كل بيانات الرفوف والكتب مع "إلغاء المزامنة" إذا تأخر السيرفر
     */
    syncFull: async (books: any[], shelves: any[], activeStatus: string = 'Idle') => {
        try {
            const deviceId = await syncBridge.getDeviceId();
            
            // حساب دقيق للدقائق الكُلية المخزنة في الكتب
            const totalSec = books.reduce((acc, b) => acc + (b.timeSpentSeconds || 0), 0);
            
            const payload = {
                deviceId,
                data: {
                    activeStatus,
                    shelves: shelves.map(s => ({ id: s.id, name: s.name, color: s.color })),
                    books: books.map(b => ({
                        id: b.id,
                        title: b.title,
                        shelfId: b.shelfId,
                        stars: b.stars || 0,
                        timeSpentSeconds: b.timeSpentSeconds || 0
                    })),
                    readingStats: {
                        totalMinutes: Math.floor(totalSec / 60)
                    }
                }
            };

            // --- محرك الإرسال الذكي (بموقت زمني 5 ثوانٍ فقط) ---
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // لا ننتظر أكثر من 5 ثوانٍ

            await fetch(`${API_BASE_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal // تفعيل خاصية الإلغاء
            });

            clearTimeout(timeoutId); // مسح المؤقت في حال النجاح
            console.log('✅ Synchronized with Neural Network');

        } catch (error: any) {
            // في حالة التعطل أو التأخير، التطبيق سيتجاهل الأمر ولن يعلق!
            if (error.name === 'AbortError') {
                console.warn('⚠️ Sync timeout (Server slow), skipping pulse.');
            } else {
                console.error('❌ Network error during sync:', error.message);
            }
        }
    },

    /**
     * إرسال "نبضة" سريعة لمعرفة ماذا يقرأ المستخدم الآن
     */
    pushPulse: async (bookTitle: string) => {
        try {
            const deviceId = await syncBridge.getDeviceId();
            await fetch(`${API_BASE_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId,
                    data: { activeStatus: `Reading: ${bookTitle}` }
                })
            }).catch(() => {});
        } catch (e) {}
    }
};
