# Database Audit Report

> **Audit Date:** 2026-05-13
> **Reviewed By:** AI (nosql-mongoose-expert skill)
> **Total Models Reviewed:** 1 (User)

---

## Summary

User er location structure update kora hoyeche `latitude` ebong `longitude` use kore. Current implementation readable ebong simple calculation er jonno valo, but industry standard "GeoJSON" format follow kore na. Data volume barbe thakle performance issue hote pare.

---

## 📊 Score: [78/100]

| Category | Score | Max | Notes |
|---|---|---|---|
| Schema Design (embed vs ref, patterns, cardinality) | 18 | 25 | Location structure non-standard (separate fields vs GeoJSON). |
| Indexing Strategy | 15 | 20 | Native geospatial indexing (2dsphere) use kora jabe na eivabe. |
| Data Integrity & Types (ObjectId, enums, validators) | 18 | 20 | Zod validation valo ache, coordinates range check kora hoyeche. |
| Performance & Scalability (unbounded arrays, pagination, N+1) | 15 | 20 | Post-fetch distance calculation high volume e bottleneck hobe. |
| Mongoose Best Practices (lean, select, timestamps, hooks) | 12 | 15 | Aggregation e direct calculation na kore manual loop kora hoyeche. |
| **TOTAL** | **/78** | 100 | |

**Grade:** B (75-89)
**Honest Summary:** Readable logic but MongoDB native power (Geospatial) miss kora hoyeche.

---

## ✅ Ja Valo Ache

- **Validation Logic**: [user.validation.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/user/user.validation.ts) e `latitude` (-90 to 90) ebong `longitude` (-180 to 180) er bounds check kora hoyeche, eta data integrity-r jonno khub dorkari.
- **Readable Structure**: Frontend-er jonno `latitude` ebong `longitude` key name gulo khub e intuitive.

---

## ⚠️ Issue List

### 🔴 Critical
*Kono critical issue nai.*

### 🟠 High
- **Non-Standard Location Format** ([user.model.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/user/user.model.ts))
  - **Ki problem:** MongoDB geospatial queries (like `$near`, `$geoWithin`) use korar jonno GeoJSON format (`{ type: "Point", coordinates: [lng, lat] }`) dorkar. Separate fields e eta kaj kore na.
  - **Ki korte hobe:** GeoJSON Point format use kora uchit.
  - **Keno important:** Data jokhon lakher opore hobe, tokhon manual Haversine calculation khub slow hoye jabe. MongoDB-r native `2dsphere` index database level e search optimize kore.

### 🟡 Medium
- **Post-fetch Distance Calculation** ([user.service.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/user/user.service.ts))
  - **Ki problem:** `getUserProfilesFromDB` e aggregation pipeline theke data fetch korar por manual `.forEach` loop e distance calculate kora hocche.
  - **Ki korte hobe:** Aggregation pipeline er shuru te `$geoNear` stage use kora uchit.
  - **Keno important:** Pagination er limit jodi 10 hoy, kintu total user 10,000 thake, tahole prothome database theke sob data ene calculation kora possible na. `$geoNear` use korle database prothomei kacher user gulo ke filter kore projection kore dey.

### 🔵 Low / ⚪ Style
- **Naming consistency**: [user.interface.ts](file:///d:/Khaled/re-factor/okjt100/src/app/modules/user/user.interface.ts) e `ILocation` e fields optional kora hoyeche but validation e nested object optional. Optionality consistency thaka valo.

---

## Verdict

**Needs work for scalability.** Simple app er jonno production-ready, kintu heavy location-based features er jonno redesign dorkar.

---

## 🏆 Senior Engineer Reference Design

### Collection: User

**Tomar approach:** Location ke flat fields e rakha hoyeche (`latitude`, `longitude`).
**Senior approach:** MongoDB native **GeoJSON Point** structure use kora ebong `2dsphere` index add kora.

```typescript
// Optimized schema code
const locationSchema = new Schema({
  country: String,
  city: String,
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  }
}, { _id: false });

// In userSchema
location: locationSchema

// Index for performance
userSchema.index({ 'location.coordinates': '2dsphere' });
```

**Keno ei ta better:** 
1. **Performance**: `$geoNear` use kore query stage e distance sorting ebong filtering kora jay. Database memory usage kom hoy.
2. **Precision**: MongoDB-r internal algorithms high precision geospatial calculations optimized way te handle kore.
3. **Standard**: Third-party libraries (like Google Maps API or Leaflet) er sathe interoperability valo thake.

---

## 🔧 Update & Optimization Plan

### Priority 1 — High Impact Improvements (Scale er jonno)

| # | Ki korte hobe | File | Keno |
|---|---|---|---|
| 1 | Refactor location to GeoJSON | `user.model.ts` | Geospatial indexing enable korar jonno. |
| 2 | Use `$geoNear` in Aggregation | `user.service.ts` | Post-fetch calculation avoid korar jonno. |
| 3 | Update Zod to match GeoJSON | `user.validation.ts` | API input structure sync korar jonno. |

---

## Schema Migration Notes

Existing data jodi thake, tokhon `latitude` ebong `longitude` ke `coordinates: [longitude, latitude]` array te convert korar jonno ekta simple script lagbe. Note: MongoDB coordinates e prothome **Longitude** thake, tarpor **Latitude**. Eta industry common mistake.
