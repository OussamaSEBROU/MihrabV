
import { LocalNotifications } from '@capacitor/local-notifications';

// ===== ELITE MOTIVATIONAL QUOTES - مقولات تحفيزية نخبوية =====
const QUOTES_LIBRARY = [
  // Arabic Classical Wisdom + English Literary Quotes
  { ar: "القراءة تمد العقل فقط بلوازم المعرفة، أما التفكير فهو الذي يجعل ما نقرأه مُلكاً لنا. — جون لوك", en: "\"Reading furnishes the mind only with materials of knowledge; it is thinking that makes what we read ours.\" — John Locke" },
  { ar: "الكتب ليست أكوام ورق ميتة، إنها عقولٌ تعيش على الأرفف وتنتظر من يحاورها. — عباس محمود العقاد", en: "\"Books are not dead piles of paper, they are minds living on shelves waiting for a conversation.\" — Abbas Al-Aqqad" },
  { ar: "خير جليسٍ في الأنام كتاب. — المتنبي", en: "\"The best companion in the world is a book.\" — Al-Mutanabbi" },
  { ar: "الجهل يهدم بيوت العز والكرم، والعلم يرفع بيتاً لا عماد له. — علي بن أبي طالب", en: "\"Ignorance destroys houses of honor, and knowledge raises houses that have no pillars.\" — Ali ibn Abi Talib" },
  { ar: "القراءة غذاء الروح، والكتب هي السلم الذي نرتقي به نحو السمو الفكري.", en: "\"Reading is food for the soul, and books are the ladder by which we ascend to intellectual greatness.\"" },
  { ar: "إنّ الإنسان الذي لا يقرأ ليس أفضل حالاً من الإنسان الذي لا يستطيع القراءة. — مارك توين", en: "\"The man who does not read has no advantage over the man who cannot read.\" — Mark Twain" },
  { ar: "اقرأ كتاباً جيداً ثلاث مرات أنفع لك من أن تقرأ ثلاثة كتب. — عباس العقاد", en: "\"Read one good book three times. It is more beneficial than reading three good books once.\" — Abbas Al-Aqqad" },
  { ar: "ليس ثمة سفينة كالكتاب تأخذنا إلى أبعد الأماكن. — إميلي ديكنسون", en: "\"There is no frigate like a book to take us leagues away.\" — Emily Dickinson" },
  { ar: "الكتاب هو المعلم الذي يعلم بلا عصا ولا كلمات غضب، بلا خبز ولا مال. — ابن خلدون", en: "\"A book is a teacher that educates without a stick, without anger, without bread, or money.\" — Ibn Khaldun" },
  { ar: "التعلم هو الشيء الوحيد الذي لا يستطيع العقل أن يتعب منه أبداً. — ليوناردو دا فينشي", en: "\"Learning never exhausts the mind.\" — Leonardo da Vinci" },
  { ar: "لا تقرأ لتكون أذكى فحسب، بل اقرأ لتصبح أعمق، أوسع فهماً، وأكثر رحمة بالعالم.", en: "\"Don't read just to be smarter. Read to be deeper, broader in understanding, and more compassionate.\"" },
  { ar: "من لم يتعلم في صغره، لم يتقدم في كبره. — الإمام الشافعي", en: "\"Who does not learn in youth, does not advance in age.\" — Imam Al-Shafi'i" },
  { ar: "إذا أوى أحدكم إلى فراشه فليقرأ .. فإن القراءة نور للقلب وطمأنينة للنفس.", en: "\"Let reading be your sanctuary at night... for it is light for the heart and tranquility for the soul.\"" },
  { ar: "المعرفة الحقيقية لا تُقاس بما تحفظ، بل بما تفهم وتطبق في حياتك.", en: "\"True knowledge is not measured by what you memorize, but by what you understand and apply.\"" },
  { ar: "اقضِ وقتك مع الكتب، فهي الصديق الذي لا يغدر والمعلم الذي لا يملّ.", en: "\"Spend your time with books — they are friends that never betray and teachers that never tire.\"" },
];

interface NotificationStats {
  lastSessionMins: number;
  todayMins: number;
  totalMins: number;
  totalStars: number;
  totalBooks: number;
  bookBreakdown: { title: string; mins: number; stars: number }[];
  streak: number;
}

export const scheduleMotivationalNotifications = async (lang: 'ar' | 'en', stats: NotificationStats) => {
  try {
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display !== 'granted') {
       const result = await LocalNotifications.requestPermissions();
       if (result.display !== 'granted') return;
    }

    // Clear all previous scheduled notifications
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const isAR = lang === 'ar';
    const now = Date.now();
    const notifications: any[] = [];
    let notifId = 100;

    // ===================================================================
    // SEQUENCE 1: EXIT SUMMARY (1 minute after leaving the app)
    // حصيلة شاملة احترافية بعد دقيقة واحدة من الخروج
    // ===================================================================

    // 1A. Session Duration Summary
    const sessionText = isAR
      ? `لبثتَ في رحاب المحراب ${stats.lastSessionMins} دقيقة من التأمل والقراءة الراقية. كلُّ لحظةٍ تقضيها في العلم هي لبنةٌ في صرح وعيك المتين.`
      : `You spent ${stats.lastSessionMins} minutes in the Sanctuary in focused intellectual pursuit. Every moment invested in knowledge strengthens the architecture of your consciousness.`;
    
    notifications.push({
      id: ++notifId,
      title: isAR ? '✨ ختام جلسة التأمل المعرفي' : '✨ Intellectual Session Concluded',
      body: sessionText,
      smallIcon: 'ic_stat_icon',
      largeIcon: 'ic_launcher',
      iconColor: '#ff0000',
      schedule: { at: new Date(now + 60 * 1000), allowWhileIdle: true }
    });

    // 1B. Today's Cumulative Progress (1:15 min after exit)
    const todayText = isAR
      ? `📊 حصاد اليوم الفكري: ${stats.todayMins} دقيقة قراءة مركزة | ${stats.totalBooks} كتاب في المحراب | ${stats.totalStars} نجمة تحصيلية مضيئة`
      : `📊 Today's intellectual harvest: ${stats.todayMins} min focused reading | ${stats.totalBooks} volumes in Sanctuary | ${stats.totalStars} achievement stars`;
    
    notifications.push({
      id: ++notifId,
      title: isAR ? '📈 الحصيلة اليومية الشاملة' : '📈 Comprehensive Daily Report',
      body: todayText,
      smallIcon: 'ic_stat_icon',
      largeIcon: 'ic_launcher',
      iconColor: '#ff0000',
      schedule: { at: new Date(now + 75 * 1000), allowWhileIdle: true }
    });

    // 1C. Book-specific progress (1:30 min after exit)
    if (stats.bookBreakdown.length > 0) {
      const mainBook = stats.bookBreakdown[0];
      const bookProgressText = isAR
        ? `📜 تركيزك الأعمق اليوم كان في "${mainBook.title}" لمدة ${mainBook.mins} دقيقة — واصل الغوص في أعماق المعرفة.`
        : `📜 Your deepest focus today was on "${mainBook.title}" for ${mainBook.mins} minutes — continue diving into the depths of knowledge.`;
      
      notifications.push({
        id: ++notifId,
        title: isAR ? '📖 تقرير التركيز الأدبي' : '📖 Literary Focus Report',
        body: bookProgressText,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        iconColor: '#ff0000',
        schedule: { at: new Date(now + 90 * 1000), allowWhileIdle: true }
      });
    }

    // 1D. Cumulative Total + Growth (2 min after exit)
    const totalHours = (stats.totalMins / 60).toFixed(1);
    const cumulativeText = isAR
      ? `🏛️ بلغ رصيدك المعرفي التراكمي ${totalHours} ساعة. سلسلة الالتزام: ${stats.streak} يوم متواصل. أنت تبني إرثاً فكرياً لا يُمحى.`
      : `🏛️ Your cumulative knowledge capital: ${totalHours} hours. Consistency streak: ${stats.streak} consecutive days. You are building an intellectual legacy that endures.`;
    
    notifications.push({
      id: ++notifId,
      title: isAR ? '🏆 الأثر التراكمي المعرفي' : '🏆 Cumulative Cognitive Impact',
      body: cumulativeText,
      smallIcon: 'ic_stat_icon',
      largeIcon: 'ic_launcher',
      iconColor: '#ff0000',
      schedule: { at: new Date(now + 120 * 1000), allowWhileIdle: true }
    });

    // ===================================================================
    // SEQUENCE 2: HALF-HOURLY PROFESSIONAL NOTIFICATIONS
    // تنبيهات كل نصف ساعة — منظمة ومتنوعة ومدروسة
    // ===================================================================

    const halfHourlyTypes = [
      'summary',    // 30 min - حصيلة مختصرة
      'quote',      // 1 hr - مقولة تحفيزية 
      'books',      // 1.5 hr - عن الكتب
      'cumulative', // 2 hr - التراكمي
      'quote',      // 2.5 hr - مقولة
      'motivation', // 3 hr - تحفيز عام
      'quote',      // 3.5 hr - مقولة
      'summary',    // 4 hr - حصيلة
      'quote',      // 4.5 hr - مقولة
      'books',      // 5 hr - عن الكتب
      'cumulative', // 5.5 hr - التراكمي
      'quote',      // 6 hr - مقولة
    ];

    const usedQuoteIndices: number[] = [];
    const getUniqueQuote = (): typeof QUOTES_LIBRARY[0] => {
      let index: number;
      do {
        index = Math.floor(Math.random() * QUOTES_LIBRARY.length);
      } while (usedQuoteIndices.includes(index) && usedQuoteIndices.length < QUOTES_LIBRARY.length);
      usedQuoteIndices.push(index);
      return QUOTES_LIBRARY[index];
    };

    for (let i = 0; i < halfHourlyTypes.length; i++) {
      const type = halfHourlyTypes[i];
      const delay = (i + 1) * 30 * 60 * 1000; // Every 30 minutes
      let title = '';
      let body = '';

      switch (type) {
        case 'summary': {
          title = isAR ? '📊 ملخص أدائك المعرفي' : '📊 Knowledge Performance Summary';
          body = isAR
            ? `استثمرت ${stats.todayMins} دقيقة اليوم في القراءة المركزة. محرابك يضم ${stats.totalBooks} مجلد. كل صفحة تقرؤها تُعيد تشكيل عقلك.`
            : `You invested ${stats.todayMins} minutes today in focused reading. Your sanctuary holds ${stats.totalBooks} volumes. Every page restructures your mind.`;
          break;
        }
        case 'quote': {
          const quote = getUniqueQuote();
          title = isAR ? '🕯️ تأمُّلٌ في المحراب' : '🕯️ Sanctuary Contemplation';
          body = isAR ? quote.ar : quote.en;
          break;
        }
        case 'books': {
          if (stats.bookBreakdown.length > 0) {
            const randomBook = stats.bookBreakdown[Math.floor(Math.random() * stats.bookBreakdown.length)];
            title = isAR ? '📚 نداء المخطوطات' : '📚 The Manuscripts Calling';
            body = isAR
              ? `كتاب "${randomBook.title}" ينتظرك. قضيت فيه ${randomBook.mins} دقيقة حتى الآن — الحكمة لا تنضب لمن يواصل.`
              : `"${randomBook.title}" awaits you. You've spent ${randomBook.mins} minutes so far — wisdom never runs dry for those who persist.`;
          } else {
            const quote = getUniqueQuote();
            title = isAR ? '📚 ابدأ رحلتك الفكرية' : '📚 Begin Your Intellectual Journey';
            body = isAR ? quote.ar : quote.en;
          }
          break;
        }
        case 'cumulative': {
          const totalH = (stats.totalMins / 60).toFixed(1);
          title = isAR ? '🏛️ رصيدك التراكمي' : '🏛️ Cumulative Capital';
          body = isAR
            ? `مجموع ساعات التأمل الفكري: ${totalH} ساعة | النجوم: ${stats.totalStars} | سلسلة الالتزام: ${stats.streak} يوم. أنت من الـ 3% الذين يصنعون الفرق.`
            : `Total intellectual hours: ${totalH}h | Stars: ${stats.totalStars} | Streak: ${stats.streak} days. You are among the 3% who make the difference.`;
          break;
        }
        case 'motivation': {
          title = isAR ? '🔥 إشعال الحماس' : '🔥 Igniting Passion';
          body = isAR
            ? `تذكّر: القراءة ليست هواية، بل هي تمرين يومي لعضلة الحكمة. استمر في بناء صرح معرفتك، فالعالَمُ بحاجة إلى عقلك المستنير.`
            : `Remember: Reading is not a hobby — it is daily exercise for the wisdom muscle. Keep building your knowledge monument. The world needs your enlightened mind.`;
          break;
        }
      }

      notifications.push({
        id: ++notifId,
        title,
        body,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        iconColor: '#ff0000',
        schedule: { at: new Date(now + delay), allowWhileIdle: true }
      });
    }

    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.error("Advanced notifications scheduling failed:", e);
  }
};
