import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react'; // Link eklendi
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
// DangerButton kullanılmadığı için kaldırdım veya tutabilirsin

export default function WebsitesIndex({ auth, websites }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        domain: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('websites.store'), {
            onSuccess: () => reset(),
        });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Sitelerim</h2>}
        >
            <Head title="Sitelerim" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

                    {/* --- Site Ekleme Formu --- */}
                    <div className="p-4 sm:p-8 bg-white shadow sm:rounded-lg">
                        <header>
                            <h2 className="text-lg font-medium text-gray-900">Yeni Site Ekle</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Sohbet widget'ını ekleyeceğiniz sitenin bilgilerini girin.
                            </p>
                        </header>

                        <form onSubmit={submit} className="mt-6 space-y-6 max-w-xl">
                            <div>
                                <InputLabel htmlFor="name" value="Site Adı" />
                                <TextInput
                                    id="name"
                                    className="mt-1 block w-full"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    isFocused
                                    placeholder="Örn: Enderun Blog"
                                />
                                <InputError className="mt-2" message={errors.name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="domain" value="Domain Adresi" />
                                <TextInput
                                    id="domain"
                                    className="mt-1 block w-full"
                                    value={data.domain}
                                    onChange={(e) => setData('domain', e.target.value)}
                                    required
                                    placeholder="Örn: enderun.com"
                                />
                                <InputError className="mt-2" message={errors.domain} />
                            </div>

                            <div className="flex items-center gap-4">
                                <PrimaryButton disabled={processing}>Kaydet</PrimaryButton>
                            </div>
                        </form>
                    </div>

                    {/* --- Site Listesi --- */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <h3 className="text-lg font-bold mb-4">Ekli Siteler</h3>

                            {websites.length === 0 ? (
                                <p className="text-gray-500">Henüz site eklenmemiş.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {websites.map((site) => (
                                        <div key={site.id} className="border rounded-lg p-4 hover:shadow-md transition bg-gray-50">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-lg text-gray-800">{site.name}</h4>
                                                    <p className="text-gray-500 text-sm">{site.domain}</p>
                                                </div>
                                                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Aktif</span>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
                                                <p className="text-gray-600 mb-1 font-medium">Widget Token:</p>
                                                <code className="bg-white border border-gray-200 p-2 rounded text-xs select-all block overflow-hidden text-ellipsis font-mono text-gray-600">
                                                    {site.widget_token}
                                                </code>
                                            </div>

                                            {/* BUTONLAR ALANI */}
                                            <div className="mt-4 flex justify-end items-center space-x-3 pt-2">
                                                {/* AYARLAR BUTONU (YENİ) */}
                                                <Link
                                                    href={route('websites.edit', site.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold flex items-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    Ayarlar
                                                </Link>

                                                {/* SİL BUTONU */}
                                                <DeleteButton id={site.id} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Alt Bileşen: Silme Butonu
function DeleteButton({ id }) {
    return (
        <Link
            href={route('websites.destroy', id)}
            method="delete"
            as="button"
            className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
            preserveScroll
            onBefore={() => confirm('Bu siteyi silmek istediğinize emin misiniz?')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Sil
        </Link>
    );
}