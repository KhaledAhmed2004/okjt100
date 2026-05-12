import { Document } from 'mongoose';

export interface IPrayerTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah?: string;
}

export interface ILocation {
  latitude: number;
  longitude: number;
}

export interface IMosque extends Document {
  mosqueName: string;
  address: string;
  area: string;
  phoneNumber: string;
  website?: string;
  location: ILocation;
  prayerTimes: IPrayerTimes;
  distanceInKm?: number;
  createdAt: Date;
  updatedAt: Date;
}
