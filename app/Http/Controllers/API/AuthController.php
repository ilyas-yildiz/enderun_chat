<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Giriş bilgileri hatalı.'],
            ]);
        }

        // Eski tokenları temizleyelim (İsteğe bağlı, güvenlik için iyi)
        $user->tokens()->delete();

        // Yeni Token Oluştur (Mobil Cihaz İçin)
        $token = $user->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Çıkış yapıldı']);
    }

        public function updateDeviceToken(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        // Giriş yapmış kullanıcının tokenını güncelle
        $request->user()->update([
            'expo_push_token' => $request->token
        ]);

        return response()->json(['message' => 'Token kaydedildi']);
    }
}