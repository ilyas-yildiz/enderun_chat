<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable(); // Tarayıcı/OS bilgisi
            $table->string('browser')->nullable(); // Chrome, Safari vs.
            $table->string('os')->nullable(); // Windows, iOS vs.
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->string('current_url')->nullable(); // O an bulunduğu sayfa
        });
    }

    public function down(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->dropColumn(['ip_address', 'user_agent', 'browser', 'os', 'country', 'city', 'current_url']);
        });
    }
};
