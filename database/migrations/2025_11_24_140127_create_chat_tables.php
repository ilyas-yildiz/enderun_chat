<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Websites Tablosu
        Schema::create('websites', function (Blueprint $table) {
            $table->id();
            $table->string('domain');
            $table->string('name');
            $table->uuid('widget_token')->unique(); // Widget bağlantısı için
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // Sahibi
            $table->timestamps();
        });

        // 2. Visitors Tablosu
        Schema::create('visitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('website_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid')->unique(); // Frontend'den gelen anonim ID
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        // 3. Conversations Tablosu
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('website_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visitor_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('active'); // active, closed
            $table->timestamps();
        });

        // 4. Messages Tablosu
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            // Polymorphic Sender: (App\Models\User veya App\Models\Visitor)
            $table->string('sender_type');
            $table->unsignedBigInteger('sender_id');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            
            // Performans için index
            $table->index(['sender_type', 'sender_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('visitors');
        Schema::dropIfExists('websites');
    }
};