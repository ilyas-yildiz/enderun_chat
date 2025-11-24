<?php

namespace App\Http\Controllers;

use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Illuminate\Support\Str;

class WebsiteController extends Controller
{
    /**
     * Kullanıcının sitelerini listeler.
     */
    public function index()
    {
        return Inertia::render('Websites/Index', [
            'websites' => Auth::user()->websites()->latest()->get()
        ]);
    }

    /**
     * Yeni site kaydeder.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'domain' => 'required|string|max:255|unique:websites,domain',
        ]);

        // İlişki üzerinden create ederek user_id'yi otomatik veriyoruz
        $request->user()->websites()->create([
            'name' => $validated['name'],
            'domain' => $validated['domain'],
            'settings' => ['color' => '#4F46E5'], // Varsayılan bir renk
        ]);

        return redirect()->back();
    }
    
    /**
     * Siteyi siler.
     */
    public function destroy(Website $website)
    {
        // Başkasının sitesini silmesin diye kontrol
        if ($website->user_id !== Auth::id()) {
            abort(403);
        }

        $website->delete();

        return redirect()->back();
    }
}