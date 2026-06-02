# Market ERP Admin Paneli

React + Vite ile hazırlanmış Türkçe market ERP admin panelidir. Backend varsayılan olarak şu adrese bağlanır:

```text
http://localhost:8081/api
```

Gerekirse `.env` dosyasında değiştirebilirsiniz:

```text
VITE_API_URL=http://localhost:8081/api
```

## Kurulum

```bash
npm install
npm run dev
```

## Sayfalar

- `/login` Giriş
- `/` Dashboard
- `/firmalar` Firmalar
- `/firmalar/:id` Firma Detay
- `/personel` Personel
- `/personel/:id` Personel Detay
- `/gunluk-kasa` Günlük Kasa
- `/finans-borclari` Finans Borçları
- `/finans-borclari/:id` Finans Borcu Detay
- `/finans-uyarilari` Finans Uyarıları
- `/giderler` Giderler
- `/gelirler` Gelirler
- `/raporlar` Raporlar

## API Servisleri

Endpoint fonksiyonları [src/services/api.js](/Users/fethiaksit/Desktop/market_erp-frondend/src/services/api.js) dosyasında ayrıdır. Base URL `/api` içerir, sayfa servisleri `/dashboard`, `/financial-debts` gibi endpoint pathleriyle çağrı yapar.

## Giriş ve Token

Giriş endpointi `POST /auth/login` olarak çağrılır. Başarılı girişte token `zeytinerp_token`, kullanıcı bilgisi `zeytinerp_user` localStorage keyleriyle saklanır. Token yoksa ERP sayfaları `/login` sayfasına yönlenir; API 401 dönerse oturum temizlenir.
