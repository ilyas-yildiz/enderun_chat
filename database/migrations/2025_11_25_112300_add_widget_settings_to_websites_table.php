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
        Schema::table('websites', function (Blueprint $table) {
            $table->string('widget_color')->default('#4F46E5'); // Varsayılan İndigo
            $table->string('header_text')->default('Canlı Destek');
            $table->string('welcome_message')->default('Merhaba 👋 Size nasıl yardımcı olabilirim?');
        });
    }

    public function down(): void
    {
        Schema::table('websites', function (Blueprint $table) {
            $table->dropColumn(['widget_color', 'header_text', 'welcome_message']);
        });
    }
};
