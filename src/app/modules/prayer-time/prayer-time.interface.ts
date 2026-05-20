export interface IPrayerTimeQuery {
  latitude: number;
  longitude: number;
  date?: string; // Optional YYYY-MM-DD
  method?: string; // Optional calculation method (e.g. 'Karachi', 'ISNA', etc.)
  madhab?: 'Hanafi' | 'Shafi'; // Optional madhab for Asr calculation
}

export interface IPrayerTimesFormatted {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah?: string;
}

export interface IPrayerTimeResponse {
  weekday: string;
  hijriDate: string;
  location?: string;
  timings: IPrayerTimesFormatted;
}
