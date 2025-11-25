import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';

export default function WebsiteEdit({ auth, website }) {
    const { data, setData, patch, processing, errors, recentlySuccessful } = useForm({
        widget_color: website.widget_color || '#4F46E5',
        header_text: website.header_text || 'Canlı Destek',
        welcome_message: website.welcome_message || 'Merhaba 👋 Size nasıl yardımcı olabilirim?',
    });

    const submit = (e) => {
        e.preventDefault();
        patch(route('websites.update', website.id));
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">{website.name} - Widget Ayarları</h2>}
        >
            <Head title="Widget Ayarları" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row gap-6">

                        {/* SOL: AYAR FORMU */}
                        <div className="w-full md:w-1/2 bg-white p-8 shadow sm:rounded-lg">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Görünüm Özelleştirme</h3>

                            <form onSubmit={submit} className="space-y-6">
                                {/* Renk Seçici */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Ana Renk</label>
                                    <div className="mt-1 flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={data.widget_color}
                                            onChange={e => setData('widget_color', e.target.value)}
                                            className="h-10 w-20 p-1 border border-gray-300 rounded-md cursor-pointer"
                                        />
                                        <span className="text-sm text-gray-500">{data.widget_color}</span>
                                    </div>
                                    {errors.widget_color && <div className="text-red-500 text-sm mt-1">{errors.widget_color}</div>}
                                </div>

                                {/* Başlık Metni */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Widget Başlığı</label>
                                    <input
                                        type="text"
                                        value={data.header_text}
                                        onChange={e => setData('header_text', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        maxLength="50"
                                    />
                                    {errors.header_text && <div className="text-red-500 text-sm mt-1">{errors.header_text}</div>}
                                </div>

                                {/* Karşılama Mesajı */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Karşılama Mesajı</label>
                                    <textarea
                                        value={data.welcome_message}
                                        onChange={e => setData('welcome_message', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        rows="3"
                                        maxLength="255"
                                    />
                                    {errors.welcome_message && <div className="text-red-500 text-sm mt-1">{errors.welcome_message}</div>}
                                </div>

                                <div className="flex items-center gap-4">
                                    <button disabled={processing} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition">
                                        Kaydet
                                    </button>

                                    {recentlySuccessful && <span className="text-green-600 text-sm">Kaydedildi!</span>}

                                    <Link href={route('websites.index')} className="text-gray-600 hover:text-gray-900 text-sm ml-auto">
                                        Geri Dön
                                    </Link>
                                </div>
                            </form>
                        </div>

                        {/* SAĞ: CANLI ÖNİZLEME */}
                        <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-100 p-8 rounded-lg border border-dashed border-gray-300">
                            <div className="relative w-[350px] h-[500px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
                                {/* Header Preview */}
                                <div style={{ backgroundColor: data.widget_color }} className="p-4 text-white flex justify-between items-center transition-colors duration-300">
                                    <div>
                                        <div className="font-bold">{data.header_text || 'Başlık'}</div>
                                        <div className="text-xs opacity-80">Çevrimiçi 🟢</div>
                                    </div>
                                    <span>✕</span>
                                </div>

                                {/* Body Preview */}
                                <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
                                    {/* Karşılama Mesajı */}
                                    <div className="mb-2 text-left">
                                        <span className="inline-block bg-white text-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 text-sm">
                                            {data.welcome_message || 'Mesaj...'}
                                        </span>
                                    </div>

                                    {/* Örnek Ziyaretçi Mesajı */}
                                    <div className="mb-2 text-right">
                                        <span style={{ backgroundColor: data.widget_color }} className="inline-block text-white p-2 rounded-lg shadow-sm text-sm transition-colors duration-300">
                                            Merhaba, bilgi alabilir miyim?
                                        </span>
                                    </div>
                                </div>

                                {/* Footer Preview */}
                                <div className="p-3 border-t border-gray-100 flex gap-2">
                                    <div className="flex-1 bg-white border border-gray-300 rounded-full h-8"></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}