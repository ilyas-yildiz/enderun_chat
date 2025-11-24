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
    Schema::create('websites', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // Site sahibi
        $table->string('name'); // Örn: "Enderun Blog"
        $table->string('domain'); // Örn: "enderun.com"
        $table->uuid('widget_token')->unique(); // Script tag içinde kullanılacak public ID
        $table->json('settings')->nullable(); // Renk ayarları, karşılama mesajı vb.
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('websites');
    }
};
