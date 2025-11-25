<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\WebsiteController; // Yeni Controller'ımız
use App\Http\Controllers\DashboardChatController; // <--- Import etmeyi unutma
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    // Profil İşlemleri
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Site Yönetimi (SaaS)
    // Sadece index (listeleme), store (kaydetme) ve destroy (silme) metodlarını kullanıyoruz.
    Route::resource('websites', WebsiteController::class)->only(['index', 'store', 'destroy']);
    // Sohbet Paneli Rotası
    Route::get('/dashboard/chats', [DashboardChatController::class, 'index'])->name('chats.index');
    Route::post('/dashboard/chats/{conversation}/reply', [DashboardChatController::class, 'reply'])->name('chats.reply');
    Route::post('/dashboard/chats/{conversation}/typing', [DashboardChatController::class, 'typing'])->name('chats.typing');
    Route::delete('/dashboard/chats/{conversation}', [DashboardChatController::class, 'destroy'])->name('chats.destroy');
});

require __DIR__.'/auth.php';