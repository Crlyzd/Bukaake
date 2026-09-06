use exif::{In, Reader, Tag, Value};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Serialize, Clone, Default)]
pub struct ExifPayload {
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
    pub focal_length_35mm: Option<String>,
    pub exposure_bias: Option<String>,
    pub metering_mode: Option<String>,
    pub flash: Option<String>,
    pub date_time_original: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub gps_altitude: Option<f64>,
    pub software: Option<String>,
}

pub fn read_exif(path: &Path) -> Option<ExifPayload> {
    let file = File::open(path).ok()?;
    let mut buf = BufReader::new(file);
    let exif = Reader::new().read_from_container(&mut buf).ok()?;

    let mut payload = ExifPayload::default();

    let get_field = |tag: Tag| -> Option<String> {
        exif.get_field(tag, In::PRIMARY)
            .map(|f| f.display_value().to_string().trim_matches('"').trim().to_string())
    };

    payload.make = get_field(Tag::Make);
    payload.model = get_field(Tag::Model);
    payload.lens = get_field(Tag::LensModel);
    payload.software = get_field(Tag::Software);
    payload.date_time_original = get_field(Tag::DateTimeOriginal);

    // Format exposure time e.g. "1/250 s" or "2 s"
    if let Some(et) = get_field(Tag::ExposureTime) {
        payload.exposure_time = Some(if et.ends_with('s') { et } else { format!("{} s", et) });
    }

    // Format aperture e.g. "f/2.8"
    if let Some(fn_val) = get_field(Tag::FNumber) {
        payload.f_number = Some(if fn_val.starts_with("f/") { fn_val } else { format!("f/{}", fn_val) });
    }

    // ISO
    payload.iso = get_field(Tag::PhotographicSensitivity)
        .or_else(|| get_field(Tag::ISOSpeed));

    // Focal length
    if let Some(fl) = get_field(Tag::FocalLength) {
        payload.focal_length = Some(if fl.ends_with("mm") { fl } else { format!("{} mm", fl) });
    }
    if let Some(fl35) = get_field(Tag::FocalLengthIn35mmFilm) {
        payload.focal_length_35mm = Some(format!("{} mm", fl35));
    }

    // Exposure bias
    if let Some(eb) = get_field(Tag::ExposureBiasValue) {
        payload.exposure_bias = Some(if eb.ends_with("EV") { eb } else { format!("{} EV", eb) });
    }

    // Metering mode
    if let Some(f) = exif.get_field(Tag::MeteringMode, In::PRIMARY) {
        if let Value::Short(ref v) = f.value {
            payload.metering_mode = Some(match v.first().copied().unwrap_or(0) {
                1 => "Average".into(),
                2 => "Center-weighted average".into(),
                3 => "Spot".into(),
                4 => "Multi-spot".into(),
                5 => "Pattern / Multi-segment".into(),
                6 => "Partial".into(),
                _ => "Other".into(),
            });
        }
    }

    // Flash
    if let Some(f) = exif.get_field(Tag::Flash, In::PRIMARY) {
        if let Value::Short(ref v) = f.value {
            let code = v.first().copied().unwrap_or(0);
            payload.flash = Some(if (code & 1) != 0 { "Fired".into() } else { "Did not fire".into() });
        }
    }

    // GPS Latitude & Longitude
    parse_gps(&exif, &mut payload);

    // Return Some if at least one meaningful field exists
    if payload.make.is_some()
        || payload.model.is_some()
        || payload.f_number.is_some()
        || payload.exposure_time.is_some()
        || payload.iso.is_some()
        || payload.date_time_original.is_some()
    {
        Some(payload)
    } else {
        None
    }
}

fn parse_gps(exif: &exif::Exif, payload: &mut ExifPayload) {
    let lat_f = exif.get_field(Tag::GPSLatitude, In::PRIMARY);
    let lat_ref = exif.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
    let lon_f = exif.get_field(Tag::GPSLongitude, In::PRIMARY);
    let lon_ref = exif.get_field(Tag::GPSLongitudeRef, In::PRIMARY);

    let dms_to_deg = |field: &exif::Field| -> Option<f64> {
        if let Value::Rational(ref rats) = field.value {
            if rats.len() >= 3 {
                let d = rats[0].to_f64();
                let m = rats[1].to_f64();
                let s = rats[2].to_f64();
                return Some(d + m / 60.0 + s / 3600.0);
            }
        }
        None
    };

    if let (Some(lf), Some(lr)) = (lat_f, lat_ref) {
        if let Some(mut deg) = dms_to_deg(lf) {
            let ref_str = lr.display_value().to_string();
            if ref_str.contains('S') {
                deg = -deg;
            }
            payload.gps_latitude = Some(deg);
        }
    }

    if let (Some(lf), Some(lr)) = (lon_f, lon_ref) {
        if let Some(mut deg) = dms_to_deg(lf) {
            let ref_str = lr.display_value().to_string();
            if ref_str.contains('W') {
                deg = -deg;
            }
            payload.gps_longitude = Some(deg);
        }
    }

    if let Some(alt_f) = exif.get_field(Tag::GPSAltitude, In::PRIMARY) {
        if let Value::Rational(ref rats) = alt_f.value {
            if let Some(alt) = rats.first() {
                payload.gps_altitude = Some(alt.to_f64());
            }
        }
    }
}
