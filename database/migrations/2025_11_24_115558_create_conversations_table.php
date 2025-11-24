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
    Schema::create('conversations', function (Blueprint $table) {
        $table->id();
        $table->foreignId('website_id')->constrained()->cascadeOnDelete();
        $table->foreignId('visitor_id')->constrained()->cascadeOnDelete();
        // Sohbetin durumu: open (aktif), closed (bitti), archived (arşiv)
        $table->enum('status', ['open', 'closed', 'archived'])->default('open');
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
