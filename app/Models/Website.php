<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Website extends Model
{
    // Mass assignment koruması için doldurulabilir alanlar
    protected $fillable = ['name', 'domain', 'settings'];

    // Settings sütunu JSON olduğu için array'e cast edelim
    protected $casts = [
        'settings' => 'array',
    ];

    // Model oluşturulurken otomatik UUID ataması (Boot Metodu)
    protected static function booted(): void
    {
        static::creating(function (Website $website) {
            $website->widget_token = (string) Str::uuid();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function visitors(): HasMany
    {
        return $this->hasMany(Visitor::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }
}