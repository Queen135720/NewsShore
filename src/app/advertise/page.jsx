const wrap = { maxWidth: '760px', margin: '0 auto', padding: '56px 20px 96px' };
const h1s = { fontSize: '2rem', fontWeight: 700, marginBottom: '10px' };
const ps = { marginTop: '14px', marginBottom: '14px', lineHeight: 1.7 };

export default function AdvertisePage() {
  return (
    <div style={wrap}>
      <h1 style={h1s}>Advertise</h1>
      <p style={ps}>
        The NewsShore advertising program is currently in development and will launch in the
        near future.
      </p>
      <p style={ps}>
        Organizations that join at launch will receive priority placement and founding-partner
        terms. If you would like to discuss advertising or sponsorship ahead of the launch,
        please contact <strong>newsshore@gmail.com</strong> with the subject line "Advertising".
      </p>
      <p style={ps}>
        Audience information, format specifications, and rate details will be published on
        this page when the program launches.
      </p>
    </div>
  );
}
