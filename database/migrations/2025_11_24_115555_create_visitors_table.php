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
    Schema::create('visitors', function (Blueprint $table) {
        $table->id();
        $table->foreignId('website_id')->constrained()->cascadeOnDelete();
        $table->uuid('visitor_uuid'); // Tarayıcı çerezinde tutacağımız benzersiz ID
        $table->string('name')->nullable(); // Chat sırasında ismini verirse
        $table->string('email')->nullable(); // Chat sırasında emailini verirse
        $table->json('geo_data')->nullable(); // IP, Lokasyon, Tarayıcı bilgisi
        $table->timestamp('last_seen_at')->nullable();
        $table->timestamps();
        
        // Bir sitede aynı ziyaretçiyi tekrar tanımak için
        $table->unique(['website_id', 'visitor_uuid']);
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visitors');
    }
};
