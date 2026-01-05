import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import styles from '../styles/Map.module.css';

const LIBRARIES = ['places'];

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Fallback: Bengaluru
const DEFAULT_RADIUS_KM = 5;

// Haversine distance in km
function computeDistanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);

  const c = 2 * Math.atan2(
    Math.sqrt(sin1 * sin1 + Math.cos(la1) * Math.cos(la2) * sin2 * sin2),
    Math.sqrt(1 - (sin1 * sin1 + Math.cos(la1) * Math.cos(la2) * sin2 * sin2)),
  );
  return R * c;
}

// Cyberpunk / dark style for Google Maps
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#050810' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050810' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#111827' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2937' }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#020617' }]
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#022c22' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#020617' }]
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }]
  },
];

// Neon marker SVG (data URL) for print shops
const NEON_MARKER_ICON = {
  url:
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <radialGradient id="g" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="1"/>
            <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="20" cy="16" r="10" fill="url(#g)" />
        <circle cx="20" cy="16" r="6" fill="none" stroke="#f97316" stroke-width="2" />
        <circle cx="20" cy="16" r="2" fill="#e5e7eb" />
        <path d="M20 28 L15 36 L25 36 Z" fill="#22c55e" opacity="0.8"/>
      </svg>
    `),
};

export default function Shops() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [manualQuery, setManualQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [apiError, setApiError] = useState(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || key === 'YOUR_API_KEY_HERE' || key === '') {
      return 'The Google Maps API key is missing or invalid. Please add a valid key to .env.local to enable the interactive map.';
    }
    return null;
  });

  const mapRef = useRef(null);
  const placesServiceRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // Detect missing or placeholder API key
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    console.log('🗺️ API Key check:', key ? (key === 'YOUR_API_KEY_HERE' ? 'PLACEHOLDER' : 'FOUND') : 'MISSING');
    if (!key || key === 'YOUR_API_KEY_HERE' || key === '') {
      setApiError('The Google Maps API key is missing or invalid. Please add a valid key to .env.local to enable the interactive map.');
      setLoadingPlaces(false);
    }
  }, []);

  // Initialize geolocation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationError(null);
      },
      (err) => {
        console.error('Geolocation error', err);
        if (err.code === 1) {
          setLocationError('Location access denied. You can manually enter a location below.');
        } else {
          setLocationError('Unable to detect your location. Please try again or enter it manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    placesServiceRef.current = new window.google.maps.places.PlacesService(map);
  }, []);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
    placesServiceRef.current = null;
  }, []);

  const searchNearbyPrintShops = useCallback(
    (center) => {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!placesServiceRef.current || !window.google || !center || !key || key === 'YOUR_API_KEY_HERE') {
        console.warn('⚠️ Search skipped: missing dependencies or placeholder key');
        setLoadingPlaces(false);
        if (key === 'YOUR_API_KEY_HERE' || !key) {
          setApiError('The Google Maps API key is missing. Please use search on Google Maps instead.');
        }
        return;
      }

      setLoadingPlaces(true);
      setApiError(null);

      // Safety timeout for stuck searches
      const timeoutId = setTimeout(() => {
        setLoadingPlaces((current) => {
          if (current) {
            setApiError('Search timed out. This usually happens if the Places API is disabled or the key is invalid.');
            return false;
          }
          return current;
        });
      }, 10000);

      const request = {
        location: new window.google.maps.LatLng(center.lat, center.lng),
        radius: radiusKm * 1000,
        keyword: 'print shop OR xerox OR photocopy OR printing services',
        type: ['store'],
      };

      try {
        placesServiceRef.current.nearbySearch(request, (results, status) => {
          clearTimeout(timeoutId);
          setLoadingPlaces(false);

          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
            console.error('Places search failed', status);
            setApiError(`Unable to load print shops: ${status}. You can try the external search below.`);
            setShops([]);
            return;
          }

          const mapped = results.map((place) => {
            const loc = place.geometry?.location;
            const position = loc
              ? { lat: loc.lat(), lng: loc.lng() }
              : null;

            return {
              id: place.place_id,
              name: place.name,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              address: place.vicinity || place.formatted_address,
              position,
              place,
            };
          }).filter(s => s.position);

          setShops(mapped);
        });
      } catch (err) {
        clearTimeout(timeoutId);
        setLoadingPlaces(false);
        setApiError('Error initializing search. Please use the external button.');
      }
    },
    [radiusKm]
  );

  // Trigger initial search when map + userLocation are ready
  useEffect(() => {
    if (apiError) {
      setLoadingPlaces(false);
      return;
    }
    if (isLoaded && userLocation && mapRef.current) {
      searchNearbyPrintShops(userLocation);
    }
  }, [isLoaded, userLocation, searchNearbyPrintShops, apiError]);

  const handleManualLocationSubmit = (e) => {
    e.preventDefault();
    if (!manualQuery || !placesServiceRef.current || !window.google) return;

    setLoadingPlaces(true);
    setApiError(null);

    const request = {
      query: manualQuery,
      fields: ['geometry', 'formatted_address', 'name'],
    };

    placesServiceRef.current.findPlaceFromQuery(request, (results, status) => {
      setLoadingPlaces(false);

      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
        setApiError('Could not find that location. Please try another place name or city.');
        return;
      }

      const place = results[0];
      const loc = place.geometry?.location;
      if (!loc) {
        setApiError('Could not determine coordinates for that location.');
        return;
      }

      const center = { lat: loc.lat(), lng: loc.lng() };
      setUserLocation(center);
      if (mapRef.current) {
        mapRef.current.panTo(center);
        mapRef.current.setZoom(14);
      }
      searchNearbyPrintShops(center);
    });
  };

  const handleRadiusChange = (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0 && v <= 50) {
      setRadiusKm(v);
      if (userLocation) {
        searchNearbyPrintShops(userLocation);
      }
    }
  };

  const handleNavigateClick = (shop) => {
    if (!shop?.position) return;
    const { lat, lng } = shop.position;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${shop.id}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderMap = () => {
    if (loadError) {
      return (
        <div className={styles.errorCard}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <h3>Map Experience Unavailable</h3>
          <p>We couldn't initialize the internal Google Map (this usually means the API key is missing or invalid).</p>
          <button
            onClick={() => window.open('https://www.google.com/maps/search/xerox+print+shop+near+me', '_blank')}
            className={styles.primaryBtn}
            style={{ marginTop: '1rem', width: 'auto', padding: '0.75rem 1.5rem' }}
          >
            Search on Google Maps Directly ↗
          </button>
        </div>
      );
    }

    if (!isLoaded) {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const isBadKey = !key || key === 'YOUR_API_KEY_HERE' || key === '';

      return (
        <div className={styles.loadingMap}>
          {isBadKey ? (
            <div className={styles.errorCard}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
              <h3>Map Key Missing</h3>
              <p>The interactive map requires a valid API key in .env.local.</p>
              <button
                onClick={() => window.open('https://www.google.com/maps/search/xerox+print+shop+near+me', '_blank')}
                className={styles.primaryBtn}
                style={{ marginTop: '1rem', width: 'auto', padding: '0.75rem 1.5rem' }}
              >
                Search on Google Maps Directly ↗
              </button>
            </div>
          ) : (
            <>
              <div className={styles.spinner} />
              <p>Loading secure map experience...</p>
            </>
          )}
        </div>
      );
    }

    const center = userLocation || DEFAULT_CENTER;

    return (
      <GoogleMap
        mapContainerClassName={styles.map}
        center={center}
        zoom={14}
        options={{
          styles: DARK_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          backgroundColor: '#020617',
        }}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
      >
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeColor: '#bbf7d0',
              strokeWeight: 2,
            }}
          />
        )}

        {shops.map((shop) => {
          const distanceKm = computeDistanceKm(userLocation || center, shop.position);

          return (
            <Marker
              key={shop.id}
              position={shop.position}
              icon={NEON_MARKER_ICON}
              onClick={() => setSelectedShop({ ...shop, distanceKm })}
            />
          );
        })}

        {selectedShop && (
          <InfoWindow
            position={selectedShop.position}
            onCloseClick={() => setSelectedShop(null)}
          >
            <div className={styles.infoWindow}>
              <h3>{selectedShop.name}</h3>
              {selectedShop.rating && (
                <p>
                  ⭐ {selectedShop.rating.toFixed(1)}{' '}
                  <span className={styles.subtle}>
                    ({selectedShop.userRatingsTotal || 0} reviews)
                  </span>
                </p>
              )}
              {selectedShop.distanceKm != null && (
                <p>
                  📍{' '}
                  <span className={styles.subtle}>
                    {selectedShop.distanceKm.toFixed(2)} km away
                  </span>
                </p>
              )}
              {selectedShop.address && (
                <p className={styles.address}>{selectedShop.address}</p>
              )}
              <button
                className={styles.navigateBtn}
                onClick={() => handleNavigateClick(selectedShop)}
              >
                Open in Google Maps
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    );
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Privy Print - Nearby Print Shops</title>
        <meta
          name="description"
          content="Find secure, nearby print and xerox shops for your Privy Print documents."
        />
      </Head>

      <main className={styles.main}>
        <section className={styles.sidebar}>
          <h1 className={styles.title}>Nearby Print Nodes</h1>
          <p className={styles.subtitle}>
            Discover trusted Xerox / print shops around you. Location is used only in your browser and never stored on our servers.
          </p>

          <div className={styles.panel}>
            <button
              onClick={() => window.open('https://www.google.com/maps/search/xerox+print+shop+near+me', '_blank')}
              className={styles.primaryBtn}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}
            >
              📍 Find Nearby Shops
            </button>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Quick Links</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => window.open('https://www.google.com/maps/search/xerox+near+me', '_blank')}
                className={styles.secondaryBtn}
                style={{ justifyContent: 'flex-start' }}
              >
                🖨️ Xerox Shops Near Me
              </button>
              <button
                onClick={() => window.open('https://www.google.com/maps/search/printing+services+near+me', '_blank')}
                className={styles.secondaryBtn}
                style={{ justifyContent: 'flex-start' }}
              >
                📄 Printing Services Near Me
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Manual Scan</h2>
            {apiError && (
              <div style={{ padding: '0.5rem 0' }}>
                <p className={styles.errorText} style={{ marginBottom: '1rem', lineHeight: '1.4' }}>{apiError}</p>
                <button
                  onClick={() => window.open('https://www.google.com/maps/search/xerox+print+shop+near+me', '_blank')}
                  className={styles.primaryBtn}
                  style={{ width: '100%', marginBottom: '1rem' }}
                >
                  📍 Find Nearby Shops
                </button>
              </div>
            )}
            {!loadingPlaces && !apiError && shops.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p className={styles.helperText} style={{ marginBottom: '1rem' }}>
                  Need to find a shop quickly?
                </p>
                <button
                  onClick={() => window.open('https://www.google.com/maps/search/xerox+print+shop+near+me', '_blank')}
                  className={styles.primaryBtn}
                  style={{ width: '100%' }}
                >
                  📍 Find Nearby Shops
                </button>
              </div>
            )}
            <ul className={styles.shopList}>
              {shops.map((shop) => {
                const distanceKm = computeDistanceKm(userLocation || DEFAULT_CENTER, shop.position);
                return (
                  <li
                    key={shop.id}
                    className={styles.shopItem}
                    onClick={() => setSelectedShop({ ...shop, distanceKm })}
                  >
                    <div className={styles.shopMeta}>
                      <span className={styles.shopName}>{shop.name}</span>
                      {shop.rating && (
                        <span className={styles.shopRating}>
                          ⭐ {shop.rating.toFixed(1)} ({shop.userRatingsTotal || 0})
                        </span>
                      )}
                    </div>
                    <div className={styles.shopMetaBottom}>
                      {distanceKm != null && (
                        <span className={styles.shopDistance}>
                          📍 {distanceKm.toFixed(2)} km
                        </span>
                      )}
                      {shop.address && (
                        <span className={styles.shopAddress}>{shop.address}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ marginTop: 'auto', padding: '1rem' }}>
            <button
              onClick={() => window.location.href = '/'}
              className={styles.secondaryBtn}
              style={{ width: '100%', opacity: 0.8 }}
            >
              ← Back to Upload
            </button>
          </div>
        </section>

        <section className={styles.mapSection}>
          <div className={styles.mapCard}>
            {renderMap()}
          </div>
        </section>
      </main>
    </div>
  );
}


