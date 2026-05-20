import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';
import { format } from 'date-fns';
import { IPrayerTimeQuery, IPrayerTimeResponse, IPrayerTimesFormatted } from './prayer-time.interface';

const calculatePrayerTimes = async (query: IPrayerTimeQuery & { timezone?: string }): Promise<IPrayerTimeResponse> => {
  const { latitude, longitude, date, method, madhab, timezone = 'Asia/Dhaka' } = query;

  // 1. Parse Date (default to current date)
  let targetDate = new Date();
  if (date) {
    const dateParts = date.split('-');
    if (dateParts.length === 3) {
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2], 10);
      targetDate = new Date(year, month, day);
    } else {
      targetDate = new Date(date);
    }
  }

  // 2. Set coordinates
  const coordinates = new Coordinates(latitude, longitude);

  // 3. Determine calculation method
  let params;
  let methodName = 'Karachi';
  switch (method?.toLowerCase()) {
    case 'isna':
    case 'northamerica':
      params = CalculationMethod.NorthAmerica();
      methodName = 'ISNA';
      break;
    case 'mwl':
    case 'muslimworldleague':
      params = CalculationMethod.MuslimWorldLeague();
      methodName = 'Muslim World League';
      break;
    case 'egyptian':
      params = CalculationMethod.Egyptian();
      methodName = 'Egyptian General Authority of Survey';
      break;
    case 'qatar':
      params = CalculationMethod.Qatar();
      methodName = 'Qatar';
      break;
    case 'singapore':
      params = CalculationMethod.Singapore();
      methodName = 'Singapore';
      break;
    case 'dubai':
      params = CalculationMethod.Dubai();
      methodName = 'Dubai';
      break;
    case 'kuwait':
      params = CalculationMethod.Kuwait();
      methodName = 'Kuwait';
      break;
    case 'umm_al_qura':
    case 'saudi':
    case 'saudiarabia':
      params = CalculationMethod.UmmAlQura();
      methodName = 'Umm Al-Qura (Saudi Arabia)';
      break;
    case 'turkey':
      params = CalculationMethod.Turkey();
      methodName = 'Turkey';
      break;
    case 'karachi':
    default:
      params = CalculationMethod.Karachi(); // default to Karachi (commonly used in South Asia)
      methodName = 'University of Islamic Sciences, Karachi';
      break;
  }

  // 4. Determine Madhab (default to Hanafi)
  let selectedMadhab = 'Hanafi';
  if (madhab === 'Shafi') {
    params.madhab = Madhab.Shafi;
    selectedMadhab = 'Shafi';
  } else {
    params.madhab = Madhab.Hanafi;
  }

  // 5. Calculate Prayer Times
  const prayerTimes = new PrayerTimes(coordinates, targetDate, params);

  // Helper function to format Date object into HH:MM (24-hour style) in the requested timezone
  const formatTime = (time: Date): string => {
    try {
      return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      });
    } catch (error) {
      // Fallback if timezone is invalid
      return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Dhaka',
      });
    }
  };

  // Format Date string as YYYY-MM-DD timezone-neutrally
  const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

  // 6. Calculate additional fields (Weekday, Hijri Date, Location)
  const weekday = format(targetDate, 'EEEE');
  
  // Use a more robust Intl approach for Hijri date
  const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-uma', {
    day: 'numeric',
    month: 'long',
  });
  
  // Intl.DateTimeFormat often returns "Month Day". Let's ensure it's "Day Month".
  const parts = hijriFormatter.formatToParts(targetDate);
  const day = parts.find(p => p.type === 'day')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  
  // Clean up month name (replace special characters like ʻ with ')
  const cleanMonth = month?.replace(/[\u02BB\u02BC\u2018\u2019]/g, "'");
  let hijriDate = `${day} ${cleanMonth}`;
  
  // Basic check: if it contains a Gregorian month, it failed to use the Islamic calendar
  const gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (gregorianMonths.some(m => hijriDate.includes(m))) {
    // Fallback if Intl fails
    const fallbackParts = new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
      day: 'numeric',
      month: 'long',
    }).formatToParts(targetDate);
    const fDay = fallbackParts.find(p => p.type === 'day')?.value;
    const fMonth = fallbackParts.find(p => p.type === 'month')?.value?.replace(/[\u02BB\u02BC\u2018\u2019]/g, "'");
    hijriDate = `${fDay} ${fMonth}`;
  }

  // Infer simple location from timezone
  let location = timezone.split('/').pop()?.replace(/_/g, ' ');
  if (timezone === 'Asia/Dhaka') {
    location = 'Dhaka, Bangladesh';
  }

  const timings: IPrayerTimesFormatted = {
    fajr: formatTime(prayerTimes.fajr),
    sunrise: formatTime(prayerTimes.sunrise),
    dhuhr: formatTime(prayerTimes.dhuhr),
    asr: formatTime(prayerTimes.asr),
    maghrib: formatTime(prayerTimes.maghrib),
    isha: formatTime(prayerTimes.isha),
  };

  // Jummah replaces Dhuhr on Fridays (day 5). Astronomically, it starts at the exact same time as Dhuhr.
  if (targetDate.getDay() === 5) {
    timings.jummah = timings.dhuhr;
  }

  return {
    weekday,
    hijriDate,
    location,
    timings,
  };
};

export const PrayerTimeService = {
  calculatePrayerTimes,
};
