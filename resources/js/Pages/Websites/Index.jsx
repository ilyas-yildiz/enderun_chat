import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import DangerButton from '@/Components/DangerButton';

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

    const deleteWebsite = (id) => {
        if (confirm('Bu siteyi silmek istediğinize emin misiniz?')) {
            // Inertia router.delete kullanımı yerine useForm kullanmadık, manuel istek:
            // (Alternatif olarak router import edilebilir ama burada basit tutalım)
            window.location.href = '#'; // Geçici, aşağıda düzelteceğiz.
            // Inertia'nın router objesine ihtiyacımız var. 
            // Sayfa başına import { router } from '@inertiajs/react' ekleyelim.
        }
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
                                <p className="text-gray-500">Henüz hiç site eklemediniz.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {websites.map((site) => (
                                        <div key={site.id} className="border rounded-lg p-4 hover:shadow-md transition">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-lg">{site.name}</h4>
                                                    <p className="text-gray-500 text-sm">{site.domain}</p>
                                                </div>
                                                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Aktif</span>
                                            </div>

                                            <div className="mt-4 pt-4 border-t text-sm">
                                                <p className="text-gray-600 mb-1">Widget Token:</p>
                                                <code className="bg-gray-100 p-1 rounded text-xs select-all block overflow-hidden text-ellipsis">
                                                    {site.widget_token}
                                                </code>
                                            </div>

                                            {/* Basit Silme Butonu (Link kullanarak) */}
                                            <div className="mt-4 flex justify-end">
                                                {/* React tarafında router.delete kullanmak en temizidir ama 
                                                     burada Link componenti ile method="delete" kullanabiliriz. */}
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

// Alt Bileşen: Silme Butonu (Link import edilmeli)
import { Link } from '@inertiajs/react';

function DeleteButton({ id }) {
    return (
        <Link
            href={route('websites.destroy', id)}
            method="delete"
            as="button"
            className="text-red-600 hover:text-red-800 text-sm font-semibold"
            preserveScroll
        >
            Sil
        </Link>
    );
}