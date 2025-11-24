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
    Schema::create('messages', function (Blueprint $table) {
        $table->id();
        $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
        
        // sender_type ve sender_id oluşturur. (Mesajı kim attı? User mı Visitor mı?)
        $table->morphs('sender'); 
        
        $table->text('content'); // Mesaj içeriği
        $table->boolean('is_read')->default(false); // Okundu bilgisi
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
