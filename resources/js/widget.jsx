import { createRoot } from 'react-dom/client';

// Widget'ın monte edileceği element ID'si
const WIDGET_ID = 'enderun-chat-widget-container';

function initWidget() {
    // Eğer widget zaten varsa tekrar başlatma (çift yükleme koruması)
    if (document.getElementById(WIDGET_ID)) return;

    // 1. Kapsayıcı Div'i oluştur
    const widgetRoot = document.createElement('div');
    widgetRoot.id = WIDGET_ID;
    document.body.appendChild(widgetRoot);

    // 2. Script tagından konfigürasyonu oku (Örn: data-token)
    // Şu an çalışan script tagını buluyoruz (chat.js)
    const currentScript = document.currentScript || (function () {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    // Token'ı al (İleride API isteklerinde kullanacağız)
    const widgetToken = currentScript?.getAttribute('data-token');

    // Konsola bilgi bas (Geliştirme aşamasında olduğumuzu görelim)
    console.log('Enderun Chat başlatılıyor...', { token: widgetToken });

    // 3. React Uygulamasını Başlat
    const root = createRoot(widgetRoot);
    root.render(<WidgetApp token={widgetToken} />);
}

// Basit bir test bileşeni
function WidgetApp({ token }) {
    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 999999, // En üstte görünsün
        }}>
            <button
                style={{
                    backgroundColor: '#4F46E5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
                onClick={() => alert('Chat penceresi açılacak!')}
            >
                <span>💬</span>
                <span>Yardım?</span>
            </button>
            {/* Geliştirme aşamasında token kontrolü */}
            {token && <div style={{ fontSize: '10px', color: '#333', marginTop: '5px', textAlign: 'center' }}>Token: {token.slice(0, 4)}...</div>}
        </div>
    );
}

// Sayfa yüklendiğinde başlat
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initWidget();
} else {
    window.addEventListener('DOMContentLoaded', initWidget);
}