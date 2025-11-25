<?php

namespace App\Http\Controllers;

use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

class WebsiteController extends Controller
{
    public function index()
    {
        // Kullanıcının sitelerini listele
        $websites = Website::where('user_id', Auth::id())->latest()->get();
        return Inertia::render('Websites/Index', ['websites' => $websites]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'domain' => 'required|string|max:255',
            'name' => 'required|string|max:255',
        ]);

        Website::create([
            'user_id' => Auth::id(),
            'domain' => $request->domain,
            'name' => $request->name,
            'widget_token' => Str::uuid(),
            // Varsayılan ayarlar migration'dan geliyor
        ]);

        return back();
    }

    // YENİ: Ayar Sayfası
    public function edit(Website $website)
    {
        // Güvenlik: Sadece sahibi düzenleyebilir
        if ($website->user_id !== Auth::id()) {
            abort(403);
        }

        return Inertia::render('Websites/Edit', [
            'website' => $website
        ]);
    }

    // YENİ: Ayarları Kaydet
    public function update(Request $request, Website $website)
    {
        if ($website->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'widget_color' => 'required|string|regex:/^#[a-fA-F0-9]{6}$/', // Hex code formatı
            'header_text' => 'required|string|max:50',
            'welcome_message' => 'required|string|max:255',
        ]);

        $website->update($validated);

        return back();
    }

    public function destroy(Website $website)
    {
        if ($website->user_id !== Auth::id()) {
            abort(403);
        }
        $website->delete();
        return back();
    }
}