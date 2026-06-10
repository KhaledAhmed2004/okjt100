import { PrayerStepModel, SalahConfigModel } from '../app/modules/namaz/namaz.model';
import { NamazService } from '../app/modules/namaz/namaz.service';
import { logger } from '../shared/logger';

// Feature: namaz-duwa
// Seed data for the fixed 14-step Namaz prayer sequence.
export const PRAYER_STEPS = [
  {
    stepKey: 'niyyah',
    order: 1,
    stepName: 'Niyyah (Intention)',
    arabicText: 'نَوَيْتُ أَنْ أُصَلِّيَ',
    transliteration: 'Nawaitu an usalliya',
    translation:
      'I intend to pray. (The Niyyah is made silently in the heart, affirming the intention to perform the prayer for the sake of Allah.)',
    isPlaceholder: false,
  },
  {
    stepKey: 'takbir',
    order: 2,
    stepName: 'Takbir (Takbiratul Ihram)',
    arabicText: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    translation: 'Allah is the Greatest.',
    isPlaceholder: false,
  },
  {
    stepKey: 'sana',
    order: 3,
    stepName: 'Sana (Opening Supplication)',
    arabicText:
      'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلَا إِلَهَ غَيْرُكَ',
    transliteration:
      "Subhanakallahumma wa bihamdika wa tabarakasmuka wa ta'ala jadduka wa la ilaha ghayruk",
    translation:
      'Glory be to You, O Allah, and praise be to You. Blessed is Your Name and Exalted is Your Majesty. There is no god besides You.',
    isPlaceholder: false,
  },
  {
    stepKey: 'surah-al-fatihah',
    order: 4,
    stepName: 'Surah Al-Fatihah',
    arabicText:
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nالْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ\nالرَّحْمَٰنِ الرَّحِيمِ\nمَالِكِ يَوْمِ الدِّينِ\nإِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ\nاهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ\nصِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    transliteration:
      "Bismillahir rahmanir rahim\nAlhamdulillahi rabbil 'alamin\nAr-rahmanir rahim\nMaliki yawmid din\nIyyaka na'budu wa iyyaka nasta'in\nIhdinas siratal mustaqim\nSiratal ladhina an'amta 'alayhim ghayril maghdubi 'alayhim wa lad-dallin",
    translation:
      'In the name of Allah, the Most Gracious, the Most Merciful.\nAll praise is due to Allah, Lord of all the worlds.\nThe Most Gracious, the Most Merciful.\nMaster of the Day of Judgment.\nYou alone we worship, and You alone we ask for help.\nGuide us to the straight path —\nThe path of those upon whom You have bestowed favour, not of those who have earned anger nor of those who have gone astray.',
    isPlaceholder: false,
  },
  {
    stepKey: 'additional-surah',
    order: 5,
    stepName: 'Additional Surah',
    arabicText: '',
    transliteration: '',
    translation: '',
    isPlaceholder: true,
  },
  {
    stepKey: 'ruku',
    order: 6,
    stepName: 'Ruku (Bowing)',
    arabicText: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    transliteration: 'Subhana Rabbiyal Azeem',
    translation: 'Glory be to my Lord, the Most Great.',
    isPlaceholder: false,
  },
  {
    stepKey: 'qaumah',
    order: 7,
    stepName: 'Qaumah (Rising from Ruku)',
    arabicText: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ، رَبَّنَا وَلَكَ الْحَمْدُ',
    transliteration: 'Sami Allahu liman hamidah, Rabbana wa lakal hamd',
    translation: 'Allah hears those who praise Him. Our Lord, to You be all praise.',
    isPlaceholder: false,
  },
  {
    stepKey: 'first-sajdah',
    order: 8,
    stepName: 'First Sajdah (Prostration)',
    arabicText: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    transliteration: "Subhana Rabbiyal A'la",
    translation: 'Glory be to my Lord, the Most High.',
    isPlaceholder: false,
  },
  {
    stepKey: 'jalsah',
    order: 9,
    stepName: 'Jalsah (Sitting between Sajdahs)',
    arabicText: 'رَبِّ اغْفِرْ لِي',
    transliteration: 'Rabbighfir li',
    translation: 'O my Lord, forgive me.',
    isPlaceholder: false,
  },
  {
    stepKey: 'second-sajdah',
    order: 10,
    stepName: 'Second Sajdah',
    arabicText: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    transliteration: "Subhana Rabbiyal A'la",
    translation: 'Glory be to my Lord, the Most High.',
    isPlaceholder: false,
  },
  {
    stepKey: 'tashahhud',
    order: 11,
    stepName: 'Tashahhud',
    arabicText:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration:
      "At-tahiyyatu lillahi was-salawatu wat-tayyibat, as-salamu 'alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh, as-salamu 'alayna wa 'ala 'ibadillahis-salihin, ashhadu an la ilaha illallah wa ashhadu anna Muhammadan 'abduhu wa rasuluh",
    translation:
      'All greetings, prayers, and good deeds are for Allah. Peace be upon you, O Prophet, and the mercy of Allah and His blessings. Peace be upon us and upon the righteous servants of Allah. I bear witness that there is no god but Allah, and I bear witness that Muhammad is His servant and messenger.',
    isPlaceholder: false,
  },
  {
    stepKey: 'durood-ibrahim',
    order: 12,
    stepName: 'Durood Ibrahim',
    arabicText:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
    transliteration:
      "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammadin kama sallayta 'ala Ibrahima wa 'ala ali Ibrahima innaka Hamidum Majid. Allahumma barik 'ala Muhammadin wa 'ala ali Muhammadin kama barakta 'ala Ibrahima wa 'ala ali Ibrahima innaka Hamidum Majid",
    translation:
      'O Allah, send Your blessings upon Muhammad and the family of Muhammad, as You sent blessings upon Ibrahim and the family of Ibrahim. Verily, You are the Most Praiseworthy, the Most Glorious. O Allah, bless Muhammad and the family of Muhammad as You blessed Ibrahim and the family of Ibrahim. Verily, You are the Most Praiseworthy, the Most Glorious.',
    isPlaceholder: false,
  },
  {
    stepKey: 'dua',
    order: 13,
    stepName: 'Dua (Supplication after Durood)',
    arabicText:
      'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ وَارْحَمْنِي إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ',
    transliteration:
      "Allahumma inni zalamtu nafsi zulman kathiran wa la yaghfirudh-dhunuba illa anta, faghfir li maghfiratan min 'indika warhamni innaka antal Ghafurur Rahim",
    translation:
      'O Allah, I have greatly wronged myself, and none forgives sins except You. So grant me forgiveness from You and have mercy on me. Surely, You are the Oft-Forgiving, the Most Merciful.',
    isPlaceholder: false,
  },
  {
    stepKey: 'salam',
    order: 14,
    stepName: 'Salam (Closing Salutation)',
    arabicText: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    transliteration: 'Assalamu Alaikum wa Rahmatullah',
    translation: 'Peace be upon you and the mercy of Allah.',
    isPlaceholder: false,
  },
];

/**
 * Default surah assignments for the 5 prayers.
 * Used for initial seeding if no config exists.
 */
const DEFAULT_SALAH_CONFIGS = [
  {
    salahType: 'Fajr',
    rakats: [
      { rakat: 1, surahNumber: 112 }, // Al-Ikhlas
      { rakat: 2, surahNumber: 108 }, // Al-Kawthar
    ],
  },
  {
    salahType: 'Dhuhr',
    rakats: [
      { rakat: 1, surahNumber: 112 },
      { rakat: 2, surahNumber: 108 },
      { rakat: 3, surahNumber: 112 },
      { rakat: 4, surahNumber: 108 },
    ],
  },
  {
    salahType: 'Asr',
    rakats: [
      { rakat: 1, surahNumber: 112 },
      { rakat: 2, surahNumber: 108 },
      { rakat: 3, surahNumber: 112 },
      { rakat: 4, surahNumber: 108 },
    ],
  },
  {
    salahType: 'Maghrib',
    rakats: [
      { rakat: 1, surahNumber: 112 },
      { rakat: 2, surahNumber: 108 },
      { rakat: 3, surahNumber: 112 },
    ],
  },
  {
    salahType: 'Isha',
    rakats: [
      { rakat: 1, surahNumber: 112 },
      { rakat: 2, surahNumber: 108 },
      { rakat: 3, surahNumber: 112 },
      { rakat: 4, surahNumber: 108 },
    ],
  },
];

/**
 * Idempotent seed function for Namaz module.
 * Seeds both fixed prayer steps and default per-rakat configs.
 */
export const seedNamaz = async () => {
  logger.info('🚀 Starting Namaz seeding process...');

  // Try to fetch Surah Fatihah dynamically to include verses with audioUrl
  let fatihaVerses: any[] = [];
  try {
    const fatihaData = await NamazService.fetchSurahData(1);
    fatihaVerses = fatihaData.verses;
    logger.info('✅ Successfully fetched Surah Al-Fatihah dynamically for seeding');
  } catch (err) {
    logger.warn('⚠️ Could not fetch Surah Al-Fatihah from API. Using fallback.');
  }

  // ── 1. Seed Prayer Steps ───────────────────────────────────────────────────
  try {
    logger.info('🔄 Seeding/Updating prayer steps...');
    for (const step of PRAYER_STEPS) {
      const stepData: any = { ...step };
      
      if (step.stepKey === 'surah-al-fatihah' && fatihaVerses.length > 0) {
        stepData.verses = fatihaVerses;
        stepData.arabicText = fatihaVerses.map(v => v.arabicText).join('\n');
        stepData.transliteration = fatihaVerses.map(v => v.transliteration).join('\n');
        stepData.translation = fatihaVerses.map(v => v.translation).join('\n');
      }

      await PrayerStepModel.updateOne({ stepKey: step.stepKey }, { $set: stepData }, { upsert: true });
    }
    logger.info('✨ Prayer steps seeded successfully');
  } catch (err) {
    logger.error('❌ Failed to seed prayer steps:', err);
  }

  // ── 2. Seed Default Salah Configs ──────────────────────────────────────────
  try {
    for (const config of DEFAULT_SALAH_CONFIGS) {
      const existingConfig = await SalahConfigModel.findOne({ salahType: config.salahType });

      // Seed if config doesn't exist, rakats are missing, or it's using the old schema (no verses)
      const needsSeed = 
        !existingConfig || 
        !existingConfig.rakats || 
        existingConfig.rakats.length === 0 ||
        (existingConfig.rakats[0] && !(existingConfig.rakats[0] as any).verses);

      if (needsSeed) {
        logger.info(`🔄 Auto-seeding missing or outdated config for ${config.salahType}...`);
        try {
          // If it's an outdated document, we should delete it first to ensure a clean insert
          if (existingConfig) {
            await SalahConfigModel.deleteOne({ salahType: config.salahType });
          }
          await NamazService.upsertSalahConfig(config.salahType as any, config.rakats);
          logger.info(`✅ Successfully seeded ${config.salahType}`);
        } catch (error) {
          logger.warn(
            `⚠️ Failed to seed ${config.salahType}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }
    }
  } catch (err) {
    logger.error('❌ Failed during salah configurations check:', err);
  }

  logger.info('🏁 Namaz seeding process finished');
};
